import { Worker, j } from "@notionhq/workers";
import type {
	CurrentOrderForDateInput,
	CurrentOrderForDateResult,
	DayMealsResult,
	GetPastOrdersInput,
	OrderMealInput,
	OrderMealResult,
	PastOrdersResult,
} from "./forkable.js";
import { ForkableClient } from "./forkable.js";

const worker = new Worker();
export default worker;

function getClient(): ForkableClient {
	const sessionCookie = process.env.FORKABLE_SESSION_COOKIE;
	if (!sessionCookie) {
		throw new Error("FORKABLE_SESSION_COOKIE environment variable is required");
	}
	return new ForkableClient(sessionCookie);
}

type GetRestaurantsAndMealsInput = {
	date: string;
	[key: string]: string;
};

worker.tool<GetRestaurantsAndMealsInput, DayMealsResult>("getRestaurantsAndMealsForDate", {
	title: "Get Restaurants And Meals For Date",
	description:
		"Returns every available Forkable restaurant and orderable meal for a specific date (YYYY-MM-DD), grouped by delivery location. Use the returned mealId and menuId for exact ordering.",
	schema: j.object({
		date: j.string().describe("The delivery date to inspect in YYYY-MM-DD format."),
	}),
	execute: async ({ date }) => {
		return getClient().getRestaurantsAndMealsForDate(date);
	},
});

worker.tool<CurrentOrderForDateInput, CurrentOrderForDateResult>("getCurrentOrderForDate", {
	title: "Get Current Order For Date",
	description:
		"Returns your current Forkable order for a specific date, grouped by delivery location. Use locationId or locationName to narrow it to one office when needed.",
	schema: j.object({
		date: j.string().describe("The delivery date to inspect in YYYY-MM-DD format."),
		locationId: j.number().nullable().describe("Optional Forkable location/meal club ID filter."),
		locationName: j
			.string()
			.nullable()
			.describe("Optional delivery location name filter, such as 'Notion - NY'."),
	}),
	execute: async (input) => {
		return getClient().getCurrentOrderForDate(input);
	},
});

worker.tool<GetPastOrdersInput, PastOrdersResult>("getPastOrders", {
	title: "Get Past Orders",
	description:
		"Returns your past Forkable meal orders across every delivery location so you can see what you've been ordering. Defaults to the past 10 weeks. Pass weeks to change the window or endDate (YYYY-MM-DD) to anchor to a specific day instead of today.",
	schema: j.object({
		weeks: j
			.number()
			.nullable()
			.describe("Number of weeks of history to return. Defaults to 10 when null."),
		endDate: j
			.string()
			.nullable()
			.describe("Optional anchor date in YYYY-MM-DD format. Defaults to today when null."),
	}),
	execute: async (input) => {
		return getClient().getPastOrders(input);
	},
});

worker.tool<OrderMealInput, OrderMealResult>("orderMealForDate", {
	title: "Order Meal For Date",
	description:
		"Orders or replaces a Forkable meal for a specific date. Prefer passing exact mealId + menuId from getRestaurantsAndMealsForDate. mealName search is also supported, and location or restaurant filters can disambiguate.",
	schema: j.object({
		date: j.string().describe("The delivery date to order for in YYYY-MM-DD format."),
		mealName: j
			.string()
			.nullable()
			.describe("Meal name search string. Use this or exact mealId + menuId."),
		mealId: j.number().nullable().describe("Exact Forkable meal item ID."),
		menuId: j.number().nullable().describe("Exact Forkable menu ID for the selected meal."),
		restaurantName: j.string().nullable().describe("Optional restaurant name filter."),
		locationId: j.number().nullable().describe("Optional Forkable location/meal club ID filter."),
		locationName: j
			.string()
			.nullable()
			.describe("Optional delivery location name filter, such as 'Notion - NY'."),
		instructions: j.string().nullable().describe("Optional special instructions for the order."),
		selections: j
			.array(
				j.object({
					modifier: j.string().describe("Modifier name, such as 'Choose Side'."),
					option: j.string().describe("Chosen option for that modifier."),
				}),
			)
			.nullable()
			.describe("Optional modifier selections to apply to the ordered meal."),
	}),
	execute: async (input) => {
		return getClient().orderMealForDate(input);
	},
});
