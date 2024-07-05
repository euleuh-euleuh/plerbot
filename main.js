const TelegramBot = require("node-telegram-bot-api");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const request = require("request");
const fs = require("fs");
const math = require("mathjs");
require("dotenv").config();

const token = process.env.token_tele;

const bot = new TelegramBot(token, { polling: true });

let sessions = {};

const startSession = (chatId) => {
  if (sessions[chatId]) {
    clearTimeout(sessions[chatId].timeout);
  }
  sessions[chatId] = {
    timeout: setTimeout(() => {
      bot.sendMessage(
        chatId,
        "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
      );
      delete sessions[chatId];
    }, 1 * 60 * 1000),
    waitingFor: "",
  };
};

//start
bot.onText(/\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const greetingTime = new Date().getHours();

  let greeting;
  if (greetingTime >= 12 && greetingTime < 17) {
    greeting = "Selamat siang";
  } else if (greetingTime >= 5 && greetingTime < 12) {
    greeting = "Selamat pagi";
  } else {
    greeting = "Selamat malam";
  }
  const userName = msg.from.username;
  const response = `${greeting}, ${userName} \nuntuk melihat list gunakan /list`;
  bot.sendMessage(chatId, response);
  startSession(chatId);
});

//cuaca
bot.onText(/\/cuaca/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(
      chatId,
      "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
    );
    return;
  }
  bot.sendMessage(chatId, "Ingin mengetahui cuaca daerah mana?");
  startSession(chatId);
  sessions[chatId].waitingFor = "city";
});

// /hitung command
bot.onText(/\/hitung/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(
      chatId,
      "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
    );
    return;
  }
  bot.sendMessage(chatId, "Masukkan ekspresi matematika yang ingin dihitung:");
  startSession(chatId);
  sessions[chatId].waitingFor = "math";
});

// List
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(
      chatId,
      "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
    );
    return;
  }
  const commandList = ["/start", "/hitung", "/cuaca", "/gemini", "/stop"];

  const formattedList = commandList.join("\n");
  bot.sendMessage(chatId, formattedList, { parse_mode: "Markdown" });
});

bot.onText(/\/stop$/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(
      chatId,
      "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
    );
    return;
  }
  bot.sendMessage(chatId, "Sesi berakhir");
  delete sessions[chatId];
});
//gemini
const genAI = new GoogleGenerativeAI(process.env.gemini);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ],
});

const chatHistory = {};

//Gemini
bot.onText(/\/gemini/, async (msg) => {
  chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(
      chatId,
      "Sesi telah berakhir. Silakan ketik /start untuk memulai kembali.",
    );
    return;
  }
  bot.sendMessage(chatId, "Masukkan pertanyaanmu : ");

  startSession(chatId);
  sessions[chatId].waitingFor = "gemini";
});

// Handle  messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId] || msg.text.startsWith("/")) return;

  if (sessions[chatId].waitingFor === "city") {
    const city = msg.text;
    const query = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.api_cuaca}`;

    request(query, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        bot
          .sendMessage(chatId, "Mencari detail keadaan cuaca...", {
            parse_mode: "Markdown",
          })
          .then(() => {
            const res = JSON.parse(body);
            const weather = res.weather[0].main;
            const temp = res.main.temp;
            const humidity = res.main.humidity;
            const wind = res.wind.speed;
            const weatherInfo = `*****${city}*****\n\nCuaca: ${weather}\nSuhu: ${temp}°C\nKelembaban: ${humidity}%\nKecepatan angin: ${wind} m/s`;

            bot.sendMessage(chatId, weatherInfo);
          })
          .catch((error) => {
            bot.sendMessage(chatId, "Kota tidak valid.");
          });
      } else {
        bot.sendMessage(
          chatId,
          `Tidak dapat menemukan data cuaca untuk ${city}. Silakan coba lagi.`,
        );
      }
    });
  } else if (sessions[chatId].waitingFor === "math") {
    const expression = msg.text;
    try {
      const result = math.evaluate(expression);
      bot.sendMessage(chatId, `Hasil: ${result}`);
    } catch (error) {
      bot.sendMessage(
        chatId,
        "Maaf, terjadi kesalahan saat menghitung. Periksa kembali ekspresi Anda.",
      );
    }
  } else if (sessions[chatId].waitingFor === "gemini") {
    const prompt = msg.text;
    if (!chatHistory[chatId]) {
      chatHistory[chatId] = [];
    }

    const generationConfigG = {
      temperature: 0.9,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    };

    const chat = model.startChat({
      history: chatHistory[chatId],
      generationConfig: generationConfigG,
    });

    chatHistory[chatId].push({
      role: "user",
      parts: [{ text: prompt }],
    });

    try {
      let buffer = [];
      const result = await chat.sendMessageStream([prompt]);
      for await (const chunk of result.stream) {
        buffer.push(chunk.text());
      }
      chatHistory[chatId].push({
        role: "model",
        parts: [{ text: buffer.join("") }],
      });

      bot.sendMessage(chatId, buffer.join(""));
    } catch (error) {
      console.error("Error:", error);
      bot.sendMessage(
        chatId,
        "Sorry, an error occurred while processing your request.",
      );
    }
  }
});

// bot.onText(/\/audio$/, (msg, match) => {
//   const chatId = msg.chat.id;

//   const audioPath = "./Recording.m4a";

//   if (!fs.existsSync(audioPath)) {
//     bot.sendMessage(
//       chatId,
//       "File audio tidak ditemukan. Pastikan path yang Anda masukkan benar.",
//     );
//     return;
//   }

//   bot.sendMessage(chatId, "Mengirim file audio...");

//   bot.sendAudio(chatId, audioPath);
// });

// bot.on("message", async (msg) => {
//   if (waitingTanya && msg.text !== "/gemini") {

bot.on("polling_error", (error) => {
  console.error(`Polling error: ${error.code} - ${error.message}`);
});
