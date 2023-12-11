const TelegramBot = require("node-telegram-bot-api")
const axios = require("axios")
const fs = require("fs")

const botToken = "6788647647:AAE0oZdik2ZV_0FeCZ4PeY-H-MQKLTmXpd8"
const openWeatherMapApiKey = "25b6e661a22ff590958913e11493e044"

const city = "Aktobe" // Название города, погоду которого хотите получить

const bot = new TelegramBot(botToken, { polling: true })

let chatSubscriptions = {}

console.log("Загружаю список чатов...")

async function saveChatSubscriptions() {
    try {
        await fs.writeFileSync(
            "chatSubscriptions.json",
            JSON.stringify(chatSubscriptions)
        )
        console.log("Обновлен список чатов: ", chatSubscriptions)
    } catch (error) {
        console.error("Ошибка при сохранении списка чатов:", error)
    }
}

async function loadChatSubscriptions() {
    try {
        const chatData = await fs.readFileSync("chatSubscriptions.json", "utf8")
        chatSubscriptions = JSON.parse(chatData)
        console.log("Список подписок загружен:", chatSubscriptions)
    } catch (error) {
        console.error("Ошибка при загрузке списка чатов:", error)
    }
}

// Получение URL изображения по коду иконки погоды
function getWeatherIconURL(iconCode) {
    const iconURLs = {
        "01d": "./images/light/1d.jpg",
        "02d": "./images/light/02d.jpg",
        "03d": "./images/light/03d.jpg",
        "04d": "./images/light/04d.jpg",
        "09d": "./images/light/09d.jpg",
        "10d": "./images/light/10d.jpeg",
        "11d": "./images/light/11d.jpg",
        "13d": "./images/light/13d.jpeg",
        "50d": "./images/light/50d.jpg",
        // И так далее для других состояний погоды днем

        "01n": "./images/night/01n.jpg",
        "02n": "./images/night/02n.jpg",
        "03n": "./images/night/03n.jpg",
        "04n": "./images/night/04n.jpg",
        "09n": "./images/night/09n.jpg",
        "10n": "./images/night/10n.jpg",
        "11n": "./images/night/11n.jpg",
        "13n": "./images/night/13n.jpg",
        "50n": "./images/night/50n.jpg",
        // И так далее для других состояний погоды ночью
    }

    return iconURLs[iconCode] || "./images/default.jpg"
}

// Функция, которая получает погоду для заданного города
async function getWeather() {
    let weatherData
    try {
        await axios
            .get(
                `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${openWeatherMapApiKey}&units=metric`
            )
            .then((response) => {
                weatherData = response.data
            })

        return weatherData
    } catch (error) {
        console.error("Error fetching weather:", error)
        return null
    }
}

// Проверка времени для отправки погоды каждый день в 6:30 утра
function sendScheduledWeather() {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    if (currentHour === 6 && currentMinute === 30) {
        Object.keys(chatSubscriptions).forEach((chatId) => {
            if (chatSubscriptions[chatId]) {
                sendWeatherMessage(chatId)
            }
        })
    }
}
function getWindDirectionText(deg) {
    if (deg >= 337.5 || deg < 22.5) {
        return "Северный"
    } else if (deg >= 22.5 && deg < 67.5) {
        return "Северо-восточный"
    } else if (deg >= 67.5 && deg < 112.5) {
        return "Восточный"
    } else if (deg >= 112.5 && deg < 157.5) {
        return "Юго-восточный"
    } else if (deg >= 157.5 && deg < 202.5) {
        return "Южный"
    } else if (deg >= 202.5 && deg < 247.5) {
        return "Юго-западный"
    } else if (deg >= 247.5 && deg < 292.5) {
        return "Западный"
    } else if (deg >= 292.5 && deg < 337.5) {
        return "Северо-западный"
    } else {
        return "Направление не определено"
    }
}
async function sendWeatherMessage(chatId) {
    const weather = await getWeather()
    if (weather) {
        const temperature = weather.main.temp
        const feelsLike = weather.main.feels_like
        const windSpeed = weather.wind.speed // Скорость ветра
        const windDirection = weather.wind.deg // Направление ветра
        const windDirectionText = getWindDirectionText(windDirection) // Получение текстового представления направления ветра
        const iconCode = weather.weather[0].icon

        const message =
            `<b>Погода в городе ${city}:</b>\n\n` +
            `<b>Температура:</b> ${temperature}°C\n` +
            `<b>Ощущается как:</b> ${feelsLike}°C\n` +
            `<b>Скорость ветра:</b> ${windSpeed} м/с\n` +
            `<b>Направление ветра:</b> ${windDirectionText}`

        const iconURL = getWeatherIconURL(iconCode)

        bot.sendPhoto(chatId, iconURL, {
            caption: message,
            parse_mode: "HTML",
        })
    } else {
        bot.sendMessage(
            chatId,
            "Не удалось получить погоду. Пожалуйста, попробуйте позже."
        )
    }
}

// Расписание отправки погоды
setInterval(sendScheduledWeather, 60000) // Проверка каждую минуту

// Загрузка списка чатов из файла при запуске
loadChatSubscriptions()

// Обработка команды /start_weather_bot

const UserCommand = (chatId, command) => {
    let message = ""
    switch (command) {
        case "/start":
            if (!(chatId in chatSubscriptions)) {
                console.log(`Добавлен новый пользыватель id:${chatId}`)
                message = "Вы подписались на ежедневную рассылку погоды в 6:30."
                chatSubscriptions[chatId] = true
                saveChatSubscriptions()
            } else {
                if (chatSubscriptions[chatId])
                    message = "Вы уже подписаны на рассылку погоды."
                else {
                    message = "Возобновляю рассылку"
                    chatSubscriptions[chatId] = true
                    saveChatSubscriptions()
                }
            }

            break
        case "/disable":
            if (chatId in chatSubscriptions) {
                if (chatSubscriptions[chatId]) {
                    chatSubscriptions[chatId] = false
                    saveChatSubscriptions()
                    message = "Рассылка погоды отключена."
                } else {
                    message = "Рассылка погоды уже отключена."
                }
            } else {
                bot.sendMessage(
                    chatId,
                    "Вы не были подписаны на рассылку погоды."
                )
            }
            break
        case "/weather":
            if (!(chatId in chatSubscriptions)) {
                message =
                    "Вы не подписаны на рассылку. Чтобы активировать напишите /start "
            } else if (chatSubscriptions[chatId]) {
                sendWeatherMessage(chatId)
            } else
                message =
                    "У вас отключена рассылка. Чтобы включить напишите /start"
            break

        default:
            break
    }
    if (message !== "") bot.sendMessage(chatId, message)
    message = ""
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    UserCommand(chatId, "/start")
})
bot.onText(/\/weather/, (msg) => {
    const chatId = msg.chat.id
    UserCommand(chatId, "/weather")
})

// Обработка команды /disable_weather_bot
bot.onText(/\/disable/, (msg) => {
    const chatId = msg.chat.id
    UserCommand(chatId, "/disable")
})

// Обработка команды /help для отображения доступных команд
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id
    const helpMessage = `Доступные команды:\n/start - подписаться на ежедневную рассылку погоды в 6:30\n/disable - отписаться от рассылки погоды`
    bot.sendMessage(chatId, helpMessage)
})

// Обработка ошибок
bot.on("polling_error", (error) => {
    console.error("Polling error:", error)
})
