"use strict";

const DbMixin = require("../../mixins/db.mixin");
const {MoleculerError} = require("moleculer").Errors;
const GameModel = require("./models/game.model");
const PlayerModel = require("./models/player.model");

module.exports = {
	name: "game",

	mixins: [DbMixin("game")],

	settings: {
		// Available fields in the responses
		fields: [
			"_id",
			"users",
			"is_private",
			"type"
		],

		// Validator for the `create` & `insert` actions.
		entityValidator: {
			game_id: "string|min:8",
			user_id: "string|min:8",
			drawing_data: "string|min:16"
		}
	},

	hooks: {
		before: {}
	},

	actions: {
		/**
		 * The "moleculer-db" mixin registers the following actions:
		 */
		get: false,
		list: true,
		find: false,
		count: false,
		create: false,
		insert: false,
		update: false,
		remove: false,

		// --- ADDITIONAL ACTIONS ---

		/**
		 * Save the drawing data
		 */
		submitDrawing: {
			auth: true,
			rest: "POST /submit-drawing",
			params: {
				game_id: "string",
				drawing_data: "string"
			},
			async handler(ctx) {
				const game = await this.adapter.findById(ctx.params.game_id);
				if (!game || !game.users) throw new MoleculerError("Invalid Game ID", 401, "ERR", {});

				const userNumber = game.users.findIndex(user => user.user_id === ctx.meta.user.user_id);
				if (userNumber === -1) throw new MoleculerError("Invalid User ID", 401, "ERR", {});

				const drawing_data = game.users[userNumber].drawing_data;
				if (game.users[userNumber].drawing_data) throw new MoleculerError("Drawing already submitted",
					401, "ERR", {drawing_data: drawing_data});

				const query = `users.${userNumber}.drawing_data`;
				const doc = await this.adapter.updateById(ctx.params.game_id,
					{
						$set: {[query]: ctx.params.drawing_data}
					});
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;
			}
		},
		/**
		 * Get Game Data
		 */
		getGame: {
			rest: "GET /:game_id",
			params: {
				game_id: "string"
			},
			async handler(ctx) {
				return await this.adapter.findById(ctx.params.game_id);
			}
		},
		/**
		 * Get Game Data For User
		 */
		getGameForUser: {
			rest: "GET /:game_id/:user_id",
			params: {
				game_id: "string",
				user_id: "string"
			},
			async handler(ctx) {
				return await this.adapter.find({
					query: {
						_id: ctx.params.game_id,
						users: {$elemMatch: {user_id: ctx.params.user_id}}
					}
				});
			}
		},
		/**
		 * Join/Create New Game
		 */
		play: {
			auth: true,
			rest: "POST /play",
			params: {
				user_id: "string"
			},
			async handler(ctx) {
				const game = await this.adapter.find({
					limit: 100,
					query: {
						users: {$size: 1},
						"users.0.user_id": {$ne: ctx.meta.user.user_id},
						is_private: false
					}
				});
				if (game && game.length > 0) {
					this.logger.info("Joined Game");
					return await ctx.call("game.join", {game_id: game[0]._id, user_id: ctx.meta.user.user_id});
				} else {
					this.logger.info("New Game Created");
					return await ctx.call("game.new", {user_id: ctx.meta.user.user_id});
				}
			}
		},
		/**
		 * Join Existing Game
		 */
		join: {
			auth: true,
			rest: "POST /join-game",
			params: {
				game_id: "string",
				user_id: "string",
				is_private: {type: "boolean", optional: true}
			},
			async handler(ctx) {
				const game = await this.adapter.findById(ctx.params.game_id);
				if (!game || !game.users || game.users.length !== 1) {
					throw new MoleculerError("Invalid Game ID for User", 401, "ERR", {});
				}
				if (ctx.params.is_private && !game.is_private) {
					throw new MoleculerError("Invalid Privacy Level", 401, "ERR", {});
				}

				const doc = await this.adapter.updateById(ctx.params.game_id, {
					$push: {
						users: {
							$each: [{
								user_id: ctx.meta.user.user_id,
								drawing_data: null,
								votes: 0
							}]
						}
					}
				});
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;
			}
		},
		/**
		 * Create New Game
		 */
		new: {
			auth: true,
			rest: "POST /new-game",
			params: {
				is_private: {type: "boolean", optional: true}
			},
			async handler(ctx) {
				let gameModel = new GameModel();
				let playerModel = new PlayerModel();
				playerModel.user_id = ctx.meta.user.user_id;
				gameModel.users.push(playerModel);
				const doc = await this.adapter.insert(gameModel);

				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("inserted", json, ctx);
				return json;
			}
		},
		/**
		 * Vote On Existing Game
		 */
		vote: {
			auth: true,
			rest: "POST /vote",
			params: {
				game_id: "string",
				vote_id: "string"
			},
			async handler(ctx) {
				const game = await this.adapter.findById(ctx.params.game_id);
				if (!game || !game.users || game.users.length !== 2) {
					throw new MoleculerError("Invalid Game ID for User", 401, "ERR", {});
				}

				const userNumber = game.users.findIndex(user => user.user_id === ctx.params.vote_id);
				if (userNumber === -1) throw new MoleculerError("Invalid Game ID for User", 401, "ERR", {});

				//const canVote = await ctx.call('profile.vote', ctx.params);

				const query = `users.${userNumber}.votes`;
				const doc = await this.adapter.updateById(ctx.params.game_id,
					{
						$inc: {[query]: 1}
					});
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;
			}
		},
	},

	methods: {
		async seedDB() {
			await this.adapter.insertMany([
				{
					_id: "123a",
					users: [
						{user_id: "876b", drawing_data: "^%FTUVVTDXTWCDCVUWbib7&T^", votes: 0},
						{user_id: "111b", drawing_data: "^%FTUVV&^&^^WCDCVUWbib7&T^", votes: 3}
					],
					is_private: false,
					type: "vs"
				},
				{
					_id: "123b",
					users: [
						{user_id: "876b", drawing_data: "^%FTUVVTDXTadsWCDCVUWbib7&T^", votes: 4},
						{user_id: "111b", drawing_data: "^%FTUVV&^&^^WCsdvDCVUWbib7&T^", votes: 3}
					],
					is_private: true,
					type: "vs"
				},
				{
					_id: "123c",
					users: [
						{user_id: "user1", drawing_data: "^%FTUVVTDXTadsWCDCVUWbib7&T^", votes: 4},
					],
					is_private: false,
					type: "vs"
				},
			]);
		}
	},

	async afterConnected() {
		// await this.adapter.collection.createIndex({ name: 1 });
	}
};
