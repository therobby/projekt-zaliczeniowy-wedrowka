const moongose = require("mongoose");
const fs = require("fs");

const db_name = "Wycieczkowo";
const db_uri = "mongodb://localhost/" + db_name;

const UserSchema = new moongose.Schema({
	username: String,
	password: String,
	journeys: [{ type: String }],
});
const User = moongose.model("User", UserSchema);

const JourneySchema = new moongose.Schema({
	title: String,
	description: String,
	distance: Number,
	from: String,
	to: String,
	photos: [{ type: String }],
	video: { type: String, default: undefined },
	video_type: { type: String, default: undefined },
	date_from: { type: Date, default: Date.now },
	date_to: { type: Date, default: Date.now },
});

const Journey = moongose.model("Journey", JourneySchema);

class DataBase {
	constructor() {
		moongose.connect(db_uri, { useNewUrlParser: true, useUnifiedTopology: true });
	}

	connect() {
		return new Promise((resolve, reject) => {
			this.db = moongose.connection;
			this.db.on("error", (err) => {
				console.error("connection error:\n" + err);
				reject();
			});
			this.db.once("open", () => {
				resolve();
			});
		});
	}

	/**
	 *
	 * @param {string} username
	 * @param {string} password
	 *
	 * @returns {boolean, string}
	 */
	async login(username, password) {
		try {
			let res = await User.findOne({ username, password }).exec();
			return res !== null;
		} catch (err) {
			console.error("Login query error:\n" + err);
			return "Login query error";
		}
	}

	async register(username, password, isAdmin) {
		let exists = (await User.findOne({ username }).exec()) ? true : false;

		if (!exists) {
			await User.create({ username, password, isAdmin });
			return true;
		} else return false;
	}

	async removeJourney(username, j_id) {
		let user = await this.getUser(username);
		user.journeys.splice(user.journeys.indexOf(j_id), 1);
		user.save();
		await Journey.remove({ _id: j_id });
	}

	async changeJourney(j_id, journey) {
		let j = await Journey.findOne({ _id: j_id });

		// console.log({ journey, vid: journey.video, vid_v: journey.video.video });

		j.title = journey.title;
		j.description = journey.description;
		j.distance = journey.distance;
		j.from = journey.from;
		j.to = journey.to;
		if (journey.photos) {
			j.photos.push(...journey.photos);
		}
		if (j.video && journey.video) {
			fs.unlinkSync("./public/udata/" + j.video);
			j.video = journey.video.video;
			j.video_type = journey.video.type;
		} else if (journey.video) {
			j.video = journey.video.video;
			j.video_type = journey.video.type;
		}
		j.date_from = journey.date_from;
		j.date_to = journey.date_to;

		// console.log({ j });

		j.save();
	}

	async addJourney(username, journey) {
		let user = await this.getUser(username);
		let j = await Journey.create({
			title: journey.title,
			description: journey.description,
			distance: journey.distance,
			from: journey.from,
			to: journey.to,
			photos: journey.photos,
			video: journey.video ? journey.video.video : undefined,
			video_type: journey.video ? journey.video.type : undefined,
			date_from: journey.date_from,
			date_to: journey.date_to,
		});
		user.journeys.push(j._id);
		user.save();

		return j._id;
	}

	async getUser(username) {
		return await User.findOne({ username }).exec();
	}

	async deletePhoto(username, photo) {
		let user = await this.getUser(username);
		for (let i = 0; i < user.journeys.length; i++) {
			let journey = await Journey.findOne({ _id: user.journeys[i] }).exec();
			if (journey.photos.includes(photo)) {
				try {
					fs.unlinkSync("./public/udata/" + journey.photos[journey.photos.indexOf(photo)]);
				} catch (e) {
					console.error(e);
				}
				journey.photos.splice(journey.photos.indexOf(photo), 1);
				journey.save();
			}
		}
	}

	async deleteVideo(username, video) {
		let user = await this.getUser(username);
		for (let i = 0; i < user.journeys.length; i++) {
			let journey = await Journey.findOne({ _id: user.journeys[i] }).exec();
			if (journey.video == video) {
				try {
					fs.unlinkSync("./public/udata/" + journey.video);
				} catch (e) {
					console.error(e);
				}
				journey.video = undefined;
				journey.video_type = undefined;
				journey.save();
			}
		}
	}

	async getJourney(_id) {
		return await Journey.findOne({ _id: _id }).exec();
	}

	async getUserJourneys(username) {
		let journeys = [];
		let user = await this.getUser(username);
		for (let i = 0; i < user.journeys.length; i++) {
			let j = await Journey.findOne({ _id: user.journeys[i] }).exec();
			console.log({ j: user.journeys });

			journeys.push(j);
		}
		// console.log({ journeys });
		return journeys;
	}
}

module.exports = DataBase;
