class Journey {
	constructor(title, description, distance, from, to, date_from, date_to, photos = undefined, video = undefined) {
		this.title = title;
		this.description = description;
		this.distance = distance;
		this.from = from;
		this.to = to;
		this.date_from = date_from;
		this.date_to = date_to;
		this.photos = photos;
		this.video = video;
	}
}

module.exports = Journey;
