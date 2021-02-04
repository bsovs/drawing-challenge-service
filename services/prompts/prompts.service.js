"use strict";

const DbMixin = require("../../mixins/db.mixin");
const {MoleculerError} = require("moleculer").Errors;

module.exports = {
	name: "prompts",

	mixins: [DbMixin("prompts")],

	settings: {
		fields: [
			"_id",
			"text"
		],

		entityValidator: {
			prompt: "string|min:3",
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
		 * Get Random Prompt
		 */
		random: {
			params: {},
			async handler() {
				return await this.adapter.collection.aggregate([{$sample: {size: 1}}]).next();
			}
		},
		/**
		 * Insert New Prompt
		 */
		new: {
			auth: true,
			rest: "POST /new",
			params: {
				text: "string"
			},
			async handler(ctx) {
				return await this.adapter.insert({
					text: ctx.params.text,
					date: Date.now()
				});
			}
		},
	},

	methods: {
		async seedDB() {
			await this.adapter.insertMany([
				{text: "ungu bunga", date: Date.now()},
				{text: "ooga booga", date: Date.now()},
				{text: "test prompt 123", date: Date.now()}
			]);
		}
	},

	async afterConnected() {

	}
};
