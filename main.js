// Import Module
const { Telegraf } = require("telegraf");
const Twit = require("twit");
const Credentials = require("./config.json");

// Set Credential
const TwitterCredential = {
	consumer_key: Credentials.twitter.consumer_key,
	consumer_secret: Credentials.twitter.consumer_secret,
	access_token: Credentials.twitter.access_token,
	access_token_secret: Credentials.twitter.access_token_secret,
};
const TelegramCredential = Credentials.telegram.access_token;

// Instantiate Object
const T = new Twit(TwitterCredential);
const BOT = new Telegraf(TelegramCredential);
const LISTENER = {
	status: false,
};

// Temp Array to Store the Step
let STEP = [];

// Global Tweet Object
const TWEET = {
	link: ``,
	id: ``,
	content: ``,
	page: ``,
	screenName: ``,
};

// User check
function check(ctx) {
	if (ctx.from.username !== Credentials.telegram.username) {
		BOT.telegram.sendMessage(
			ctx.chat.id,
			"You're not permitted to use this BOT",
			{}
		);

		return false;
	}

	return true;
}

// Reset command after it finished
function resetCommand() {
	STEP = [];

	TWEET.link = "";
	TWEET.id = "";
	TWEET.content = "";
	TWEET.page = "";
	TWEET.screenName = "";

	LISTENER.status = false;
	return;
}

// Follow twitter target
function follow(username) {
	return new Promise((resolve, reject) => {
		let params = {
			screen_name: username,
			follow: false,
		};

		T.post("friendships/create", params, function (err, data) {
			if (err) {
				return reject(err);
			}

			return resolve();
		});
	});
}

// Retweet tweet target
function retweet(id) {
	return new Promise((resolve, reject) => {
		let params = {
			id: id,
		};

		T.post("statuses/retweet/:id", params, function (err, data) {
			if (err) {
				if (err.code != 327) {
					reject(err);
					return;
				}
				resolve();
				return;
			}

			resolve();
			return;
		});
	});
}

// Quote Retweet tweet target
function quoteRetweet(obj) {
	return new Promise((resolve, reject) => {
		let params = {
			status: `${obj.content}
            ${obj.link}`,
		};

		let returnData = {
			link: "",
			tweetID: obj.id,
			screenName: obj.screenName,
		};

		T.post("statuses/update", params, (err, data) => {
			if (err) {
				reject(err);
				return;
			}
			
			returnData.link = `https://twitter.com/${data.user.screen_name}/status/${data.id_str}`;
			return resolve(returnData);
		});
	});
}

// Like tweet target
function like(id) {
	return new Promise((resolve, reject) => {
		let params = {
			id: id,
		};

		T.post("favorites/create", params, function (err, data) {
			if (err) {
				if (err.code !== 139) {
					reject(err);
					return;
				}
				resolve();
				return;
			}

			resolve();
			return;
		});
	});
}

async function twitterTask(tw, ctx) {
	try {
		let retweeted = await quoteRetweet(tw);
		await retweet(retweeted.tweetID);
		await like(retweeted.tweetID);
		await follow(retweeted.screenName);

		ctx.reply(retweeted.link);
		ctx.reply(`--SUCCESSFULY [LIKE, FOLLOW, RETWEET]--
===[] @snowfluke []===`);

		resetCommand();
	} catch (err) {
		console.log(err.message);
		ctx.reply("--ERROR: SOMETHINGS WRONG--");
	}
}

BOT.start(async (ctx) => {
	let verified = check(ctx);
	if (!verified) return;

	BOT.telegram.sendMessage(ctx.chat.id, "Bot ready to serve", {});
	return;
});

BOT.command("init", async (ctx) => {
	let verified = check(ctx);
	if (!verified) return;

	ctx.reply(`===[] Created by. Awal Ariansyah []===
--INSERT TWEET URL--`);

	LISTENER.status = true;
	return;
});

BOT.on("text", async (ctx) => {
	if (!LISTENER.status) return;
	const text = ctx.update.message.text;

	if (STEP.length == 0) {
		try {
			let tweetID = text.split("/status/")[1].split("?")[0];
			if (!tweetID) return ctx.reply("--ERROR: INVALID URL--");

			TWEET.link = text;
			TWEET.page = text.split("/status/")[0];
			TWEET.id = tweetID;
			TWEET.screenName = TWEET.page.split(".com/")[1];

			STEP.push(1);
			ctx.reply("--INSERT CAPTION (280 CHARS)--");
			return;
		} catch (err) {
			ctx.reply("--ERROR: INVALID URL--");
			console.log(err.message);
		}
		return;
	}

	TWEET.content = text.slice(0, 280);

	ctx.reply("PROCESSING...");
	try {
		await twitterTask(TWEET, ctx);
	} catch (err) {
		ctx.reply("--ERROR: SOMETHINGS WRONG--");
		console.log(err.message);
	}
});

BOT.launch();
console.log("BOT is running");
