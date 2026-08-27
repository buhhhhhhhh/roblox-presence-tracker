const {
    Client,
    GatewayIntentBits,
    MessageFlags
} = require("discord.js");

// ==============================
// CONFIG
// ==============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const CHANNEL_ID = "1541467267177652377";

const ROBLOX_USER_ID = 700107028;

const TOWN_PLACE_ID = "4991214437";

const CHECK_INTERVAL = 10000; // 10 seconds

let lastBotMessage = null;
// ==============================
// DISCORD CLIENT
// ==============================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
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
        // OFFLINE
        // =========================================================

      else if (currentStatus === "offline") {

    // Don't immediately announce offline.
    // Roblox can briefly report offline while switching servers.

    if (lastStatus !== "offline") {

        console.log("Temporarily offline — waiting before announcing.");

        setTimeout(async () => {

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

                const data = await response.json();
                const presence = data.userPresences?.[0];

                const isPlaying =
                    presence &&
                    presence.userPresenceType === 2;

                if (!isPlaying) {

                    const channel =
                        await client.channels.fetch(CHANNEL_ID);

             if (lastBotMessage) {
    try {
        await lastBotMessage.delete();
    } catch (error) {
        console.log("Previous message could not be deleted.");
    }
}

lastBotMessage = await channel.send({
    content:
        "🔴 **The founder is not playing Roblox.**",

    flags: MessageFlags.SuppressNotifications
});

                    lastStatus = "offline";
                    lastGameId = null;

                    console.log(
                        "Player is confirmed offline."
                    );
                }

                else {
                    console.log(
                        "Player is back in Roblox — ignoring temporary offline state."
                    );
                }

            } catch (error) {
                console.error(
                    "Offline verification error:",
                    error
                );
            }

        }, 15000); // Wait 15 seconds
    }
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
