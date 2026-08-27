const {
    Client,
    GatewayIntentBits,
    MessageFlags
} = require("discord.js");

const express = require("express");

// ==============================
// CONFIGg
// ==============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const CHANNEL_ID = "1541467267177652377";

const ROBLOX_USER_ID = 700107028;

const TOWN_PLACE_ID = "4991214437";

const CHECK_INTERVAL = 10000; // 10 seconds

let lastPCStatus = null;
let lastBotMessage = null;

function isPCOnline() {
    return Date.now() - lastPCHeartbeat < PC_OFFLINE_TIMEOUT;
}
// ==============================
// DISCORD CLIENT
// ==============================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});


// ==============================
// PC HEARTBEAT
// ==============================

const app = express();

app.use(express.json());

let lastPCHeartbeat = 0;

const PC_OFFLINE_TIMEOUT = 30000; // 30 seconds

app.post("/heartbeat", (req, res) => {
    lastPCHeartbeat = Date.now();

    console.log("PC heartbeat received.");

    res.send("OK");
});

app.get("/", (req, res) => {
    res.send("Roblox Tracker is running.");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Heartbeat server is running.");
});
// ==============================
// TRACKING
// ==============================

// Possible statuses:
// "town"
// "other"
// "offline"

let lastStatus = null;

// Used to detect changing Town servers
let lastGameId = null;


// ==============================
// CHECK ROBLOX PRESENCE
// ==============================

async function checkRobloxPresence() {

    console.log(
        `[${new Date().toLocaleTimeString()}] Checking Roblox presence...`
    );

    try {

        const response = await fetch(
            "https://presence.roblox.com/v1/presence/users",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    userIds: [ROBLOX_USER_ID]
                })
            }
        );


        if (!response.ok) {
            throw new Error(
                `Roblox API returned ${response.status}`
            );
        }


        const data = await response.json();

        const presence = data.userPresences?.[0];


        if (!presence) {
            console.log("No presence information.");
            return;
        }


        // ==============================
        // DETERMINE STATUS
        // ==============================

        const isPlayingRoblox =
            presence.userPresenceType === 2;

        const isPlayingTown =
            isPlayingRoblox &&
            String(presence.placeId) === TOWN_PLACE_ID;


        let currentStatus;


        if (isPlayingTown) {
            currentStatus = "town";
        }

        else if (isPlayingRoblox) {
            currentStatus = "other";
        }

        else {
            currentStatus = "offline";
        }


        // ==============================
        // GET GAME SERVER ID
        // ==============================

        const gameId = presence.gameId || null;


        console.log(
            `Status: ${
                currentStatus === "town"
                    ? "PLAYING TOWN"
                    : currentStatus === "other"
                        ? "PLAYING ANOTHER GAME"
                        : "NOT PLAYING"
            } | Place ID: ${presence.placeId || "None"} | Game ID: ${gameId || "None"}`
        );


        // ==============================
        // GET DISCORD CHANNEL
        // ==============================

        const channel = await client.channels.fetch(CHANNEL_ID);


        if (!channel) {
            console.log("Could not find Discord channel.");
            return;
        }


        // =========================================================
        // TOWN
        // =========================================================

        if (currentStatus === "town") {

            // Detect:
            // 1. Starting Town
            // 2. Switching to another Town server

            const statusChanged =
                lastStatus !== "town";

            const serverChanged =
                lastStatus === "town" &&
                lastGameId !== gameId;


           if (statusChanged || serverChanged) {

    if (gameId) {

       const joinLink =
    `https://www.roblox.com/games/start?placeId=${TOWN_PLACE_ID}&gameInstanceId=${gameId}`;

        let messageText;

        if (serverChanged) {
            messageText =
                `🔵 **The founder switched Town servers!**\n` +
                `**Join Up :)** ${joinLink}`;
        } else {
            messageText =
                `🟢 **The founder is now playing Town!**\n` +
                `**Join Up :)** ${joinLink}`;
        }

        // Delete previous bot message
        if (lastBotMessage) {
            try {
                await lastBotMessage.delete();
            } catch (error) {
                console.log("Previous message could not be deleted.");
            }
        }

        // Send new message
        lastBotMessage = await channel.send({
            content: messageText,
            flags: MessageFlags.SuppressNotifications
        });

        console.log(
            serverChanged
                ? "Founder switched Town servers."
                : "Founder started playing Town."
        );

    } else {

        console.log(
            "Playing Town, but server ID was unavailable."
        );
    }
}
        }


        // =========================================================
        // OTHER ROBLOX GAME
        // =========================================================

        else if (currentStatus === "other") {

            if (lastStatus !== "other") {

             if (lastBotMessage) {
    try {
        await lastBotMessage.delete();
    } catch (error) {
        console.log("Previous message could not be deleted.");
    }
}

lastBotMessage = await channel.send({
    content:
        "🟡 **The founder is playing another Roblox game.**",

    flags: MessageFlags.SuppressNotifications
});


                console.log(
                    "Player is playing another Roblox game."
                );
            }
        }


  // =========================================================
// OFFLINE / PC STATUS
// =========================================================

else if (currentStatus === "offline") {

    const pcOnline = isPCOnline();

    const newStatus = pcOnline
        ? "pc_online"
        : "pc_offline";

    // Detect change in offline/PC state
    if (lastPCStatus !== newStatus || lastStatus !== "offline") {

        // Delete previous bot message
        if (lastBotMessage) {
            try {
                await lastBotMessage.delete();
            } catch (error) {
                console.log("Previous message could not be deleted.");
            }
        }

        let messageText;

        if (pcOnline) {

            messageText =
                "🔴 **The founder is offline.**";

        } else {

            messageText =
                "⚫ **The founder is away from their computer.**";
        }

        // Send new message
        lastBotMessage = await channel.send({
            content: messageText,
            flags: MessageFlags.SuppressNotifications
        });

        console.log(
            pcOnline
                ? "PC is ON — founder is offline."
                : "PC is OFF — founder is away from their computer."
        );

        lastPCStatus = newStatus;
    }

    // Save state
    lastStatus = "offline";
    lastGameId = null;
}
        // ==============================
        // SAVE CURRENT STATE
        // ==============================

  if (currentStatus !== "offline") {

    lastStatus = currentStatus;

    lastGameId =
        currentStatus === "town"
            ? gameId
            : null;

    // Reset PC status when Roblox is being played
    lastPCStatus = null;
}


    }

    catch (error) {

        console.error(
            "Roblox presence error:",
            error
        );
    }
}


// ==============================
// BOT READY
// ==============================

client.once("clientReady", () => {

    console.log(
        `Logged in as ${client.user.tag}`
    );


    // Check immediately
    checkRobloxPresence();


    // Then check every 10 seconds
    setInterval(
        checkRobloxPresence,
        CHECK_INTERVAL
    );
});


// ==============================
// LOGIN
// ==============================

client.login(DISCORD_TOKEN);
