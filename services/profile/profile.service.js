"use strict";

const DbMixin = require("../../mixins/db.mixin");
const {MoleculerError} = require("moleculer").Errors;
const mongodb = require("mongodb");
const ObjectID = mongodb.ObjectID;

module.exports = {
	name: "profile",

	mixins: [DbMixin("profile")],

	settings: {
		fields: [
			"_id",
			"games",
			"prompt",
			"game_id"
		],

		entityValidator: {
			game_id: "string|min:8",
			user_id: "string|min:8"
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
		 * My Profile
		 */
		me: {
			auth: true,
			rest: "GET /me",
			params: {},
			async handler(ctx) {
				const user = await this.adapter.findById(ctx.meta.user.user_id);
				if (!user) return await ctx.call("profile.new");
				else return user;
			}
		},
		/**
		 * Add Profile
		 */
		new: {
			auth: true,
			async handler(ctx) {
				const doc = await this.adapter.insert({
					_id: ctx.meta.user.user_id,
					display_name: ctx.meta.user.name,
					games: [],
					votes: [],
					coins: 0,
					gems: 0
				});
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("inserted", json, ctx);

				return json;
			}
		},
		/**
		 * Update Current Game
		 */
		addGame: {
			auth: true,
			params: {
				game_id: "string"
			},
			async handler(ctx) {
				const doc = await this.adapter.updateById(ctx.meta.user.user_id, {
					$push: {
						games: {
							$each: [{
								game_id: ctx.params.game_id,
								active: true
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
		 * Get Current Game
		 */
		current: {
			auth: true,
			rest: "GET /:game_id",
			params: {
				game_id: "string"
			},
			async handler(ctx) {
				/*
				const user = await this.adapter.findOne({
					_id: ctx.meta.user.user_id,
					games: {$elemMatch: {game_id: ctx.params.game_id}}
				}); */
				return await ctx.call("game.getGameForUser", {
					game_id: ctx.params.game_id,
					user_id: ctx.meta.user.user_id
				});
			}
		},
		/**
		 * Get Games
		 */
		games: {
			auth: true,
			rest: "GET /games",
			async handler(ctx) {
				const user = await this.adapter.findById(ctx.meta.user.user_id);
				const game_ids = user.games.map(game => game.game_id);
				return await ctx.call("game.getGames", {
					game_ids: game_ids,
				});
			}
		},
		/**
		 * Vote
		 */
		vote: {
			auth: true,
			params: {
				game_id: "any"
			},
			async handler(ctx) {
				const doc = await this.adapter.collection.findOneAndUpdate({
					_id: ctx.meta.user.user_id,
					votes: {$nin: [ctx.params.game_id]}
				},
				{
					$push: {
						votes: {
							$each: [ctx.params.game_id]
						}
					}
				});
				if (!doc.value) throw new MoleculerError("Already voted", 401, "ERR", {});

				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;
			}
		},
		/**
		 * Voting Queue
		 */
		voteQueue: {
			auth: true,
			rest: "GET /vote-queue",
			params: {},
			async handler(ctx) {
				const profile = await this.adapter.findById(ctx.meta.user.user_id);
				return await ctx.call("game.filteredList", {filter_out: profile.votes});
			}
		},
	},

	methods: {
		async seedDB() {}
	},

	async afterConnected() {

	}
};
