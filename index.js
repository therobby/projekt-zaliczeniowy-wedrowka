const express = require("express");
const path = require("path");
const mustache = require("mustache-express");
const DataBase = require("./database");
const Journey = require("./DataBase/Journey");
const crypto = require("crypto");
const body_parser = require("body-parser");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const fs = require("fs");

const port = 2222;
const public = path.join(__dirname, "public");

const database = new DataBase();

const app = express();

function getHash(variable) {
	return crypto.createHash("sha256").update(variable).digest("hex");
}

app.use("/public", express.static(public));
app.use(body_parser.json());
app.use(
	body_parser.urlencoded({
		extended: true,
	})
);
app.use(
	fileUpload({
		createParentPath: true,
	})
);

app.use(
	session({
		secret: "[oirgfjnosdiavn-9qae8rgojoiarehgpiosdfnblkeaqngiu",
		resace: false,
		saveUninitialized: true,
		cookie: { secret: true },
	})
);

app.engine("html", mustache());
app.set("view engine", "html");
app.set("views", public + "/pages");

app.get("/login", (request, response) => {
	if (request.session.user) {
		response.redirect("/");
	}
	response.render("login");
});
app.post("/login", async (request, response) => {
	if (request.session.user) {
		response.redirect("/");
	}
	// console.log({ body: request.body });
	if (request.body && request.body.password && request.body.username) {
		let pass = getHash(request.body.password);
		let username = request.body.username;
		let res = await database.login(username, pass);
		// console.log({ res });
		if (res) {
			request.session.user = { username };
		}
		response.send(res);
	} else {
		console.warn("Invalid post request body for /login");
		response.redirect("/login");
	}
});
app.get("/register", (request, response) => {
	if (request.session.user) {
		response.redirect("/");
	}
	response.render("register");
});
app.post("/register", async (request, response) => {
	if (request.session.user) {
		response.redirect("/");
	}
	console.log({ body: request.body });
	if (request.body && request.body.password && request.body.username) {
		let pass = getHash(request.body.password);
		let username = request.body.username;
		let res = await database.register(username, pass);
		response.send(res);
	} else {
		console.warn("Invalid post request body for /register");
	}
});

app.get("/logout", auth, (request, response) => {
	request.session.user = undefined;
	response.redirect("/");
});

app.get("/journey/new", auth, (request, response) => {
	response.render("addJourney", { username: request.session.user.username });
});

app.post("/journey/new", auth, async (request, response) => {
	if (
		request.body &&
		request.body.title &&
		request.body.desc &&
		request.body.distance &&
		request.body.from &&
		request.body.to &&
		request.body.date_from &&
		request.body.date_to
	) {
		let journey;
		journey = new Journey(
			request.body.title,
			request.body.desc,
			request.body.distance,
			request.body.from,
			request.body.to,
			request.body.date_from,
			request.body.date_to
		);

		if (request.files) {
			Object.values(request.files).forEach((file, index) => {
				console.log({ file, f: Object.keys(request.files)[0] });
				if (Object.keys(request.files)[index] === "video" || Object.keys(request.files)[0] == "video") {
					let filename = Date.now() + Object.keys(request.files)[index] + file.name;
					journey.video = { video: filename, type: file.mimetype };
					file.mv("./public/udata/" + filename);
					console.log("video");
				} else {
					if (!journey.photos) journey.photos = [];
					if (Array.isArray(file)) {
						file.forEach((f) => {
							let filename = Date.now() + Object.keys(request.files)[index] + f.name;
							journey.photos.push(filename);
							f.mv("./public/udata/" + filename);
							console.log("photo");
						});
					} else {
						let filename = Date.now() + Object.keys(request.files)[index] + file.name;
						journey.photos.push(filename);
						file.mv("./public/udata/" + filename);
						console.log("photo");
					}
				}
			});
		}

		if (request.body.edit) {
			await database.changeJourney(request.body.edit, journey);
			response.redirect("/journey/" + request.body.edit);
		} else {
			let id = await database.addJourney(request.session.user.username, journey);
			response.redirect("/journey/" + id);
		}
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/journey/:id/edit", auth, async (request, response) => {
	let udata = "/public/udata/";
	if (request.params.id) {
		let j = await database.getJourney(request.params.id);

		let photos = [];
		let video;

		if (j.photos) {
			for (let i = 0; i < j.photos.length; i++) {
				photos.push({ photo: udata + j.photos[i], photo_name: j.photos[i] });
			}
		}

		if (j.video && j.video_type) {
			video = { name: j.video, type: j.video_type, video: udata + j.video };
		}

		response.render("addJourney", {
			edit: true,
			username: request.session.user.username,
			_id: j._id,
			title: j.title,
			desc: j.description,
			distance: j.distance,
			from: j.from,
			to: j.to,
			date_from: fromatDateRev(j.date_from),
			date_to: fromatDateRev(j.date_to),
			photos: photos.length < 1 ? undefined : photos,
			video,
		});
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/journey/:id/delete", auth, async (request, response) => {
	if (request.params.id) {
		let j = await database.getJourney(request.params.id);

		if (j.photos) {
			for (let i = 0; i < j.photos.length; i++) {
				await database.deletePhoto(request.session.user.username, j.photos[i]);
			}
		}

		if (j.video && j.video_type) {
			await database.deleteVideo(request.session.user.username, j.video);
		}

		await database.removeJourney(request.session.user.username, j._id);

		response.redirect("/journey");
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/journey", auth, async (request, response) => {
	let j = await database.getUserJourneys(request.session.user.username);
	let journeys = [];
	let udata = "/public/udata/";
	j.forEach((journey) => {
		journeys.push({
			title: journey.title,
			desc_short: journey.description.length > 100 ? journey.description.substring(0, 97) + "..." : journey.description,
			photo: journey.photos.length > 0 ? udata + journey.photos[0] : undefined,
			_id: journey._id,
			date_from: formatDate(journey.date_from),
			date_to: formatDate(journey.date_to),
		});
	});
	response.render("journey", { username: request.session.user.username, journey_page: true, journey: journeys });
});

app.get("/journey/:id", auth, async (request, response) => {
	//req.params.id
	let udata = "/public/udata/";
	if (request.params.id) {
		let j = await database.getJourney(request.params.id);

		let photos = [];
		let video;

		if (j.photos) {
			for (let i = 0; i < j.photos.length; i++) {
				photos.push({ photo: udata + j.photos[i] });
			}
		}

		if (j.video && j.video_type) {
			video = { video: udata + j.video, type: j.video_type };
		}

		response.render("singleJourney", {
			username: request.session.user.username,
			_id: j._id,
			title: j.title,
			desc: j.description,
			distance: j.distance,
			from: j.from,
			to: j.to,
			date_from: formatDate(j.date_from),
			date_to: formatDate(j.date_to),
			photos: photos.length < 1 ? undefined : photos,
			video,
		});
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/journey/:id/:video_name/video/delete", auth, async (request, response) => {
	if (request.params.video_name && request.params.id) {
		await database.deleteVideo(request.session.user.username, request.params.video_name);
		response.redirect("/journey/" + request.params.id + "/edit");
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/journey/:id/:photo_name/photo/delete", auth, async (request, response) => {
	if (request.params.photo_name && request.params.id) {
		await database.deletePhoto(request.session.user.username, request.params.photo_name);
		response.redirect("/journey/" + request.params.id + "/edit");
	} else {
		response.send("Wystąpił błąd po stronie serwera");
	}
});

app.get("/", (request, response) => {
	if (request.session.user && request.session.user.username) {
		response.render("home", { username: request.session.user.username });
	} else {
		response.render("home");
	}
});

app.get("/*", (_, response) => {
	response.redirect("/");
});

database
	.connect()
	.then(() => {
		app.listen(port, () => {
			console.log("Running at " + port);
		});
	})
	.catch(() => {
		console.error("DataBase connection failure! Fix errors and start again");
	});

function auth(request, response, next) {
	if (request.session.user) {
		next();
	} else {
		response.redirect("/");
	}
}

function formatDate(date) {
	return date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
}

function fromatDateRev(date) {
	return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
}
