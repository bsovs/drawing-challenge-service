"use strict";

const async = require("async");

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = function () {

	let inserter;

	return {
		created() {
			inserter = async.cargo((tasks, callback) => {
				this.logger.info(`Bulk Created [${tasks.length}] tasks for 'play-game' cargo worker.`);

				this.adapter.find({
					limit: 100,
					query: {
						users: {$size: 1},
						is_private: {$ne: true}
					}
				})
					.then(games => {
						for (const task of tasks) {
							let game;
							if (games && games.length > 0) {
								const index = games.findIndex(_game => _game.users[0].user_id != task.meta.user.user_id);
								if (index > -1) {
									game = games.splice(index, 1)[0];
								}
							}
							if (game) {
								this.logger.info("Joined Game");
								task.call("game.join", {game_id: game._id, user_id: task.meta.user.user_id})
									.then(json => task.callback(json))
									.catch(error => {
										task.callback(error);
									});
							} else {
								this.logger.info("New Game Created");
								task.call("game.new", {user_id: task.meta.user.user_id})
									.then(json => task.callback(json))
									.catch(error => {
										task.callback(error);
									});
							}
						}
					})
					.then(callback)
					.catch(error => {
						callback(error);
					});
			}, 100);
		},

		mixins: [],

		events: {},

		methods: {
			queue(ctx) {
				return new Promise((resolve) => {
					ctx.callback = (res) => {
						resolve(res);
					};
					inserter.push(ctx);
				});
			}
		},

		async started() {
		}
	};
};
