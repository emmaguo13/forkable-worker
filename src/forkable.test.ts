import type { OrderMealInput } from "./forkable.js";
import { ForkableClient } from "./forkable.js";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const SESSION_COOKIE = "test-session-cookie";

function mockGraphQL(data: unknown): void {
	mockFetch.mockResolvedValueOnce({
		ok: true,
		json: async () => ({ data }),
	});
}

beforeEach(() => {
	mockFetch.mockReset();
});

describe("ForkableClient", () => {
	describe("getRestaurantsAndMealsForDate", () => {
		it("groups meals by restaurant, excludes disabled items, and includes the current order", async () => {
			mockGraphQL({
				myDeliveries: [
					{
						id: 100,
						forDeliveryAt: "2026-02-19T12:00:00.000Z",
						isReadOnly: true,
						mealClubId: 3916,
						availableMenuIds: [10, 11],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [
							{
								pieces: [
									{
										id: "piece-1",
										itemId: 501,
										menuId: 10,
										name: "Chicken Bowl",
										price: 18,
										state: "ordered",
										instructions: "extra hot",
										user: { email: "user@example.com" },
										nonHiddenAttributes: [{ label: "Choose Side", value: "Rice" }],
									},
								],
							},
						],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 10,
						name: "menu-10",
						displayName: "Cafe Good",
						venue: { id: 200, name: "cafe-good", displayName: "Cafe Good" },
						sections: [
							{
								items: [
									{
										id: 501,
										menuId: 10,
										name: "Chicken Bowl",
										description: "Grain bowl",
										price: 18,
										averageRating: 4.7,
										disabled: false,
										ingredientTags: ["gluten-free"],
										modifiers: [],
									},
									{
										id: 599,
										menuId: 10,
										name: "Sold Out Meal",
										description: "",
										price: 14,
										averageRating: null,
										disabled: true,
										ingredientTags: [],
										modifiers: [],
									},
								],
							},
						],
					},
					{
						id: 11,
						name: "menu-11",
						displayName: "Cafe Good",
						venue: { id: 200, name: "cafe-good", displayName: "Cafe Good" },
						sections: [
							{
								items: [
									{
										id: 502,
										menuId: 11,
										name: "Tofu Bowl",
										description: "Tofu bowl",
										price: 17,
										averageRating: null,
										disabled: false,
										ingredientTags: ["vegan"],
										modifiers: [],
									},
								],
							},
						],
					},
				],
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.getRestaurantsAndMealsForDate("2026-02-19");

			expect(result).toMatchObject({
				date: "2026-02-19",
				deliveryCount: 1,
				editableDeliveryCount: 0,
				restaurantCount: 1,
				mealCount: 2,
			});
			expect(result.deliveries[0]).toMatchObject({
				deliveryId: 100,
				locationId: 3916,
				locationName: "Notion - NY",
				isReadOnly: true,
			});
			expect(result.deliveries[0].restaurants).toEqual([
				{
					restaurantName: "Cafe Good",
					meals: [
						"Chicken Bowl [501/10] $18.00",
						"Tofu Bowl [502/11] $17.00",
					],
				},
			]);
		});
	});

	describe("getCurrentOrderForDate", () => {
		it("returns the current order for each delivery on a given date", async () => {
			mockGraphQL({
				me: { id: 1, email: "user@example.com" },
			});
			mockGraphQL({
				myDeliveries: [
					{
						id: 200,
						forDeliveryAt: "2025-09-22T12:00:00.000Z",
						isReadOnly: true,
						mealClubId: 3916,
						availableMenuIds: [10],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [
							{
								pieces: [
									{
										id: "piece-ny",
										itemId: 501,
										menuId: 10,
										name: "Lemongrass Chicken Pho",
										price: 17.5,
										state: "ordered",
										instructions: "extra lime",
										user: { email: "user@example.com" },
										nonHiddenAttributes: [{ label: "Protein", value: "Chicken" }],
									},
								],
							},
						],
					},
					{
						id: 201,
						forDeliveryAt: "2025-09-22T12:00:00.000Z",
						isReadOnly: true,
						mealClubId: 3902,
						availableMenuIds: [11],
						address: { formatted: "685 Market St, San Francisco, CA 94105, USA" },
						club: { id: 3902, name: "Notion - SF" },
						orders: [],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 10,
						name: "menu-10",
						displayName: "Pho Place",
						venue: { id: 300, name: "pho-place", displayName: "Pho Place" },
						sections: [],
					},
				],
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.getCurrentOrderForDate({
				date: "2025-09-22",
				locationId: null,
				locationName: null,
			});

			expect(result).toEqual({
				date: "2025-09-22",
				deliveryCount: 2,
				orderCount: 1,
				deliveries: [
					{
						deliveryId: 200,
						date: "2025-09-22",
						locationId: 3916,
						locationName: "Notion - NY",
						locationAddress: "75 Varick St, New York, NY 10013, USA",
						isReadOnly: true,
						order: {
							pieceId: "piece-ny",
							mealId: 501,
							menuId: 10,
							mealName: "Lemongrass Chicken Pho",
							restaurantName: "Pho Place",
							price: 17.5,
							state: "ordered",
							instructions: "extra lime",
							selections: ["Protein: Chicken"],
						},
					},
					{
						deliveryId: 201,
						date: "2025-09-22",
						locationId: 3902,
						locationName: "Notion - SF",
						locationAddress: "685 Market St, San Francisco, CA 94105, USA",
						isReadOnly: true,
						order: null,
					},
				],
			});
		});

		it("supports filtering to a specific location", async () => {
			mockGraphQL({
				me: { id: 1, email: "user@example.com" },
			});
			mockGraphQL({
				myDeliveries: [
					{
						id: 200,
						forDeliveryAt: "2025-09-22T12:00:00.000Z",
						isReadOnly: true,
						mealClubId: 3916,
						availableMenuIds: [10],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [],
					},
					{
						id: 201,
						forDeliveryAt: "2025-09-22T12:00:00.000Z",
						isReadOnly: true,
						mealClubId: 3902,
						availableMenuIds: [11],
						address: { formatted: "685 Market St, San Francisco, CA 94105, USA" },
						club: { id: 3902, name: "Notion - SF" },
						orders: [],
					},
				],
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.getCurrentOrderForDate({
				date: "2025-09-22",
				locationId: 3902,
				locationName: null,
			});

			expect(result).toEqual({
				date: "2025-09-22",
				deliveryCount: 1,
				orderCount: 0,
				deliveries: [
					{
						deliveryId: 201,
						date: "2025-09-22",
						locationId: 3902,
						locationName: "Notion - SF",
						locationAddress: "685 Market St, San Francisco, CA 94105, USA",
						isReadOnly: true,
						order: null,
					},
				],
			});
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe("orderMealForDate", () => {
		function exactOrderInput(overrides: Partial<OrderMealInput> = {}): OrderMealInput {
			return {
				date: "2026-03-05",
				mealName: null,
				mealId: 55,
				menuId: 10,
				restaurantName: null,
				locationId: 3916,
				locationName: null,
				instructions: "No onions",
				selections: [
					{ modifier: "Choose Side", option: "Salad" },
					{ modifier: "Add Sauce", option: "Spicy" },
				],
				...overrides,
			};
		}

		it("orders the selected meal and sends the expected replacePiece payload", async () => {
			mockGraphQL({
				myDeliveries: [
					{
						id: 123,
						forDeliveryAt: "2026-03-05T12:00:00.000Z",
						isReadOnly: false,
						mealClubId: 3916,
						availableMenuIds: [10],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [
							{
								pieces: [
									{
										id: "old-piece",
										itemId: 40,
										menuId: 9,
										name: "Old Meal",
										price: 15,
										state: "ordered",
										instructions: null,
										user: { email: "user@example.com" },
										nonHiddenAttributes: [],
									},
								],
							},
						],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 10,
						name: "menu-10",
						displayName: "Green Kitchen",
						venue: { id: 800, name: "green-kitchen", displayName: "Green Kitchen" },
						sections: [
							{
								items: [
									{
										id: 55,
										menuId: 10,
										name: "Salmon Plate",
										description: "Fresh salmon",
										price: 21.5,
										averageRating: 4.9,
										disabled: false,
										ingredientTags: ["fish"],
										modifiers: [
											{
												id: 700,
												name: "Choose Side",
												min: 1,
												max: 1,
												required: true,
												options: [
													{ id: 701, name: "Rice", price: 0 },
													{ id: 702, name: "Salad", price: 0 },
												],
											},
											{
												id: 710,
												name: "Add Sauce",
												min: 0,
												max: 1,
												required: false,
												options: [
													{ id: 711, name: "Spicy", price: 0 },
													{ id: 712, name: "Mild", price: 0 },
												],
											},
										],
									},
								],
							},
						],
					},
				],
			});
			mockGraphQL({
				me: { id: 1, email: "user@example.com" },
			});
			mockGraphQL({
				result: {
					errors: null,
					errorDetails: {},
					delivery: {
						id: 123,
						forDeliveryAt: "2026-03-05T12:00:00.000Z",
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						orders: [],
					},
				},
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.orderMealForDate(exactOrderInput());

			expect(result).toMatchObject({
				success: true,
				date: "2026-03-05",
				deliveryId: 123,
				locationId: 3916,
				locationName: "Notion - NY",
				locationAddress: "75 Varick St, New York, NY 10013, USA",
				restaurantName: "Green Kitchen",
				replacedExistingOrder: true,
				appliedSelections: [
					{ modifier: "Choose Side", option: "Salad" },
					{ modifier: "Add Sauce", option: "Spicy" },
				],
			});

			const replacePieceBody = JSON.parse(
				mockFetch.mock.calls[3][1].body as string,
			) as {
				variables: {
					input: Record<string, unknown>;
				};
			};
			expect(replacePieceBody.variables.input).toEqual({
				deliveryId: 123,
				itemId: 55,
				menuId: 10,
				instructions: "No onions",
				selectionsHash: {
					700: [702],
					710: [711],
				},
				myMeals: true,
				oldPieceId: "old-piece",
			});
		});

		it("uses addPiece for a new order and supports fuzzy modifier and option names", async () => {
			mockGraphQL({
				myDeliveries: [
					{
						id: 1151811,
						forDeliveryAt: "2026-03-27T12:00:00.000Z",
						isReadOnly: false,
						mealClubId: 3916,
						availableMenuIds: [16793],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 16793,
						name: "menu-16793",
						displayName: "Grandma's Home",
						venue: { id: 998, name: "grandmas-home", displayName: "Grandma's Home" },
						sections: [
							{
								items: [
									{
										id: 10,
										menuId: 16793,
										name: "Vegan Mapo Tofu Set",
										description: "Mapo tofu with a required side",
										price: 18,
										averageRating: 4.8,
										disabled: false,
										ingredientTags: ["vegan"],
										modifiers: [
											{
												id: 14,
												name: "Choose Side",
												min: 1,
												max: 1,
												required: true,
												options: [
													{ id: 15, name: "Lotus Root with Sticky Rice", price: 0 },
													{ id: 16, name: "Tofu Skin Rolls", price: 0 },
												],
											},
										],
									},
								],
							},
						],
					},
				],
			});
			mockGraphQL({
				me: { id: 1, email: "user@example.com" },
			});
			mockGraphQL({
				result: {
					errors: null,
					errorDetails: {},
					delivery: {
						id: 1151811,
						forDeliveryAt: "2026-03-27T12:00:00.000Z",
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						orders: [],
					},
				},
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.orderMealForDate({
				date: "2026-03-27",
				mealName: "Vegan Mapo Tofu Set",
				mealId: null,
				menuId: null,
				restaurantName: null,
				locationId: 3916,
				locationName: null,
				instructions: null,
				selections: [{ modifier: "Side", option: "Tofu Skin Roll" }],
			});

			expect(result).toMatchObject({
				success: true,
				date: "2026-03-27",
				deliveryId: 1151811,
				locationId: 3916,
				locationName: "Notion - NY",
				restaurantName: "Grandma's Home",
				appliedSelections: [{ modifier: "Choose Side", option: "Tofu Skin Rolls" }],
			});

			const replacePieceBody = JSON.parse(
				mockFetch.mock.calls[3][1].body as string,
			) as {
				query: string;
				variables: {
					input: Record<string, unknown>;
				};
			};
			expect(replacePieceBody.query).toContain("result: addPiece");
			expect(replacePieceBody.query).toContain("AddPieceInput!");
			expect(replacePieceBody.variables.input).toEqual({
				deliveryId: 1151811,
				itemId: 10,
				menuId: 16793,
				userId: 1,
				instructions: null,
				selectionsHash: {
					14: [16],
				},
				myMeals: true,
			});
		});

		it("returns an ambiguity error when mealName matches multiple meals", async () => {
			mockGraphQL({
				myDeliveries: [
					{
						id: 123,
						forDeliveryAt: "2026-03-05T12:00:00.000Z",
						isReadOnly: false,
						mealClubId: 3916,
						availableMenuIds: [10, 11],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 10,
						name: "menu-10",
						displayName: "Green Kitchen",
						venue: { id: 800, name: "green-kitchen", displayName: "Green Kitchen" },
						sections: [{ items: [{ id: 55, menuId: 10, name: "Protein Bowl", description: "", price: 18, averageRating: null, disabled: false, ingredientTags: [], modifiers: [] }] }],
					},
					{
						id: 11,
						name: "menu-11",
						displayName: "Blue Kitchen",
						venue: { id: 801, name: "blue-kitchen", displayName: "Blue Kitchen" },
						sections: [{ items: [{ id: 56, menuId: 11, name: "Protein Bowl", description: "", price: 19, averageRating: null, disabled: false, ingredientTags: [], modifiers: [] }] }],
					},
				],
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.orderMealForDate(
				exactOrderInput({
					mealName: "Protein Bowl",
					mealId: null,
					menuId: null,
					locationId: null,
				}),
			);

			expect(result.success).toBe(false);
			expect(result.message).toContain("Multiple meals matched");
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it("throws when a required modifier is missing", async () => {
			mockGraphQL({
				myDeliveries: [
					{
						id: 123,
						forDeliveryAt: "2026-03-05T12:00:00.000Z",
						isReadOnly: false,
						mealClubId: 3916,
						availableMenuIds: [10],
						address: { formatted: "75 Varick St, New York, NY 10013, USA" },
						club: { id: 3916, name: "Notion - NY" },
						orders: [],
					},
				],
			});
			mockGraphQL({
				menus: [
					{
						id: 10,
						name: "menu-10",
						displayName: "Green Kitchen",
						venue: { id: 800, name: "green-kitchen", displayName: "Green Kitchen" },
						sections: [
							{
								items: [
									{
										id: 55,
										menuId: 10,
										name: "Salmon Plate",
										description: "Fresh salmon",
										price: 21.5,
										averageRating: 4.9,
										disabled: false,
										ingredientTags: ["fish"],
										modifiers: [
											{
												id: 700,
												name: "Choose Side",
												min: 1,
												max: 1,
												required: true,
												options: [
													{ id: 701, name: "Rice", price: 0 },
													{ id: 702, name: "Salad", price: 0 },
												],
											},
										],
									},
								],
							},
						],
					},
				],
			});
			mockGraphQL({
				me: { id: 1, email: "user@example.com" },
			});

			const client = new ForkableClient(SESSION_COOKIE);
			const result = await client.orderMealForDate(
				exactOrderInput({
					selections: null,
				}),
			);
			expect(result.success).toBe(false);
			expect(result.message).toContain("Missing required selections");
		});
	});
});
