bot.onText(/\/cuaca/, (msg) => {
    const chatId = msg.chat.id;
    if (!sessions[chatId]) {
      bot.sendMessage(chatId, "sesi habis /start untuk memulai");
      return;
    }
    bot.sendMessage(chatId, "ingin mengetahui cuaca daerah mana ? ");
  
    startSession(chatId);
    sessions[chatId].waitingfor = "city";
  });
  
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (!sessions[chatId] || msg.text === "/start" || msg.text === "/cuaca")
      return;
  
    if (sessions[chatId].waitingfor == "city") {
      city = msg.text;
  
      const query = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.api_cuaca}`;
  
      request(query, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          try {
            bot
              .sendMessage(chatId, "Mencari detail keadaan cuaca... ", {
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
    }
  });
  
  //hitung
  bot.onText(/\/hitung/, (msg) => {
    const chatId = msg.chat.id;
    if (!sessions[chatId]) {
      bot.sendMessage(chatId, "sesi habis /start untuk memulai");
      return;
    }
    bot.sendMessage(chatId, "Masukkan ekspresi matematika yang ingin dihitung: ");
    startSession(chatId);
    sessions[chatId].waitingfor = "hitung";
  });
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    if (!sessions[chatId] || msg.text === "/start" || msg.text === "/hitung")
      return;
  
    if (sessions[chatId].waitingfor == "hitung") {
      const expression = msg.text;
      try {
        const result = math.evaluate(expression);
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