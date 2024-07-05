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
  const response = `${greeting}, ${userName}`;
  bot.sendMessage(chatId, response);
  startSession(chatId);
});

//cuaca

// Cuaca command
bot.onText(/\/cuaca/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(chatId, "sesi habis /start untuk memulai");
    return;
  }

  sessions[chatId].activeCommand = "/cuaca"; // Set active command
  bot.sendMessage(chatId, "ingin mengetahui cuaca daerah mana ? ");
  startSession(chatId);
});

// Hitung command
bot.onText(/\/hitung/, (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) {
    bot.sendMessage(chatId, "sesi habis /start untuk memulai");
    return;
  }

  sessions[chatId].activeCommand = "/hitung"; // Set active command
  bot.sendMessage(chatId, "Masukkan ekspresi matematika yang ingin dihitung: ");
  startSession(chatId);
});

// Handle all messages
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId] || msg.text === "/start") {
    return;
  }

  const activeCommand = sessions[chatId].activeCommand;

  if (activeCommand === "/cuaca") {
    city = msg.text;

    const query = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.api_cuaca}`;

    request(query, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        try {
          bot
            .sendMessage(chatId, "Mencari detail keadaan cuaca...", {
              parse_mode: "Markdown",
            })
            .then(() => {
              res = JSON.parse(body);
              const weather = res.weather[0].main;
              const temp = res.main.temp;
              const humidity = res.main.humidity;
              const wind = res.wind.speed;
              bot.sendMessage(
                chatId,
                "*****" +
                  city +
                  "*****" +
                  "\n" +
                  "\nCuaca : " +
                  weather +
                  "\nSuhu : " +
                  temp +
                  "°C" +
                  "\nKelembaban : " +
                  humidity +
                  "%" +
                  "\nKecepatan angin : " +
                  wind +
                  " m/s",
              );
            });
        } catch (error) {
          console.error("Error:", error);
          bot.sendMessage(chatId, "kota tidak valid.");
        }
      }
    });
  } else if (activeCommand === "/hitung") {
    const expression = msg.text;
    const result = math.evaluate(expression);
    try {
      bot.sendMessage(chatId, result.toString());
    } catch (error) {
      console.error("Error evaluating math expression:", error);
      bot.sendMessage(
        chatId,
        "Maaf, terjadi kesalahan saat menghitung. Periksa kembali ekspresi Anda.",
      );
    }
  }
});