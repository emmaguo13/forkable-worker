const FORKABLE_API_URL = "https://forkable.com/api/v2/graphql";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string }>;
}

interface GraphQLMeResponse {
	me: {
		id: number;
		email: string;
	};
}

interface GraphQLDeliveriesResponse {
	myDeliveries: ForkableDelivery[];
}

interface GraphQLMenusResponse {
	menus: ForkableMenu[];
}

interface GraphQLReplacePieceResponse {
	replacePiece: ReplacePieceResult;
}

interface ForkableUser {
	email: string;
}

interface ForkableAttribute {
	label: string;
	value: string;
}

interface ForkableOrderPiece {
	id: string;
	itemId: number;
	menuId: number;
	name: string;
	price: number;
	state: string;
	instructions: string | null;
	user: ForkableUser;
	nonHiddenAttributes: ForkableAttribute[];
}

interface ForkableOrder {
	pieces: ForkableOrderPiece[];
}

interface ForkableAddress {
	formatted: string;
}

interface ForkableClub {
	id: number;
	name: string;
}

interface ForkableDelivery {
	id: number;
	forDeliveryAt: string;
	isReadOnly: boolean;
	mealClubId: number;
	availableMenuIds: number[];
	address: ForkableAddress;
	club: ForkableClub;
	orders: ForkableOrder[];
}

interface ForkableModifierOption {
	id: number;
	name: string;
	price: number;
	ingredientTags?: string[];
}

interface ForkableModifier {
	id: number;
	name: string;
	min: number;
	max: number;
	free?: number;
	required: boolean;
	hidden?: boolean;
	options: ForkableModifierOption[];
}

interface ForkableMenuItem {
	id: number;
	menuId: number;
	name: string;
	description: string;
	price: number;
	averageRating: number | null;
	disabled: boolean;
	ingredientTags: string[];
	modifiers: ForkableModifier[];
}

interface ForkableMenuSection {
	items: ForkableMenuItem[];
}

interface ForkableVenue {
	id: number;
	name: string;
	displayName: string;
}

interface ForkableMenu {
	id: number;
	name: string;
	displayName: string;
	venue: ForkableVenue;
	sections: ForkableMenuSection[];
}

interface ReplacePieceResult {
	errors: string[] | null;
	errorDetails: Record<string, unknown>;
	delivery: {
		id: number;
		forDeliveryAt: string;
		address: ForkableAddress;
		orders: ForkableOrder[];
	};
}

export interface MealSummary {
	mealId: number;
	menuId: number;
	name: string;
	price: number;
	requiredSelections: string[];
	hasOptionalSelections: boolean;
	[key: string]: JsonValue;
}

export interface RestaurantMeals {
	restaurantName: string;
	meals: string[];
	[key: string]: JsonValue;
}

export interface DeliveryMeals {
	deliveryId: number;
	date: string;
	locationId: number;
	locationName: string;
	isReadOnly: boolean;
	restaurants: RestaurantMeals[];
	[key: string]: JsonValue;
}

export interface DayMealsResult {
	date: string;
	deliveryCount: number;
	editableDeliveryCount: number;
	restaurantCount: number;
	mealCount: number;
	deliveries: DeliveryMeals[];
	[key: string]: JsonValue;
}

export interface CurrentOrderForDateInput {
	date: string;
	locationId: number | null;
	locationName: string | null;
	[key: string]: JsonValue;
}

export interface CurrentOrderSummary {
	pieceId: string;
	mealId: number;
	menuId: number;
	mealName: string;
	restaurantName: string | null;
	price: number;
	state: string;
	instructions: string | null;
	selections: string[];
	[key: string]: JsonValue;
}

export interface CurrentOrderDelivery {
	deliveryId: number;
	date: string;
	locationId: number;
	locationName: string;
	locationAddress: string;
	isReadOnly: boolean;
	order: CurrentOrderSummary | null;
	[key: string]: JsonValue;
}

export interface CurrentOrderForDateResult {
	date: string;
	deliveryCount: number;
	orderCount: number;
	deliveries: CurrentOrderDelivery[];
	[key: string]: JsonValue;
}

export interface MealSelectionInput {
	modifier: string;
	option: string;
	[key: string]: JsonValue;
}

export interface OrderMealInput {
	date: string;
	mealName: string | null;
	mealId: number | null;
	menuId: number | null;
	restaurantName: string | null;
	locationId: number | null;
	locationName: string | null;
	instructions: string | null;
	selections: MealSelectionInput[] | null;
	[key: string]: JsonValue;
}

export interface OrderMealResult {
	success: boolean;
	message: string;
	date: string;
	deliveryId: number | null;
	locationId: number | null;
	locationName: string | null;
	locationAddress: string | null;
	restaurantName: string | null;
	meal: MealSummary | null;
	appliedSelections: Array<{ modifier: string; option: string }>;
	replacedExistingOrder: boolean;
	[key: string]: JsonValue;
}

type CandidateMeal = {
	delivery: ForkableDelivery;
	menu: ForkableMenu;
	item: ForkableMenuItem;
};

function isIsoDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertIsoDate(date: string): void {
	if (!isIsoDate(date)) {
		throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);
	}
}

function normalized(value: string | null | undefined): string {
	return (value ?? "").trim().toLowerCase();
}

function matchesBySubstring(actual: string, expected: string | null | undefined): boolean {
	if (!expected) {
		return true;
	}
	return normalized(actual).includes(normalized(expected));
}

function deliveryDate(delivery: ForkableDelivery): string {
	return delivery.forDeliveryAt.slice(0, 10);
}

function locationName(delivery: ForkableDelivery): string {
	return delivery.club.name || delivery.address.formatted;
}

function deliveryMatchesLocationFilter(
	delivery: ForkableDelivery,
	locationId: number | null | undefined,
	locationNameFilter: string | null | undefined,
): boolean {
	if (locationId != null && delivery.mealClubId !== locationId) {
		return false;
	}

	if (locationNameFilter && !matchesBySubstring(locationName(delivery), locationNameFilter)) {
		return false;
	}

	return true;
}

function mealToSummary(item: ForkableMenuItem): MealSummary {
	return {
		mealId: item.id,
		menuId: item.menuId,
		name: item.name,
		price: item.price,
		requiredSelections: (item.modifiers ?? [])
			.filter((modifier) => !modifier.hidden && modifier.required)
			.map((modifier) => {
				const options = modifier.options.map((option) => option.name).join(" | ");
				return `${modifier.name}: ${options}`;
			}),
		hasOptionalSelections: (item.modifiers ?? []).some(
			(modifier) => !modifier.hidden && !modifier.required,
		),
	};
}

function mealToListEntry(item: ForkableMenuItem): string {
	const summary = mealToSummary(item);
	const required = (item.modifiers ?? [])
		.filter((modifier) => !modifier.hidden && modifier.required)
		.map((modifier) => `${modifier.name}(${modifier.options.length})`);
	return `${summary.name} [${summary.mealId}/${summary.menuId}] $${summary.price.toFixed(2)}${
		required.length > 0 ? ` req:${required.join("; ")}` : ""
	}${summary.hasOptionalSelections ? " opt" : ""}`;
}

function existingOrderPieceForDelivery(
	delivery: ForkableDelivery,
	userEmail: string,
): ForkableOrderPiece | null {
	return (
		delivery.orders
			.flatMap((order) => order.pieces)
			.find((candidate) => normalized(candidate.user.email) === normalized(userEmail)) ?? null
	);
}

function restaurantNameForOrderPiece(
	piece: ForkableOrderPiece,
	menus: ForkableMenu[],
): string | null {
	const menu = menus.find((candidate) => candidate.id === piece.menuId);
	return menu ? menu.venue.displayName || menu.venue.name : null;
}

function summarizeCurrentOrder(
	piece: ForkableOrderPiece,
	restaurantName: string | null,
): CurrentOrderSummary {
	return {
		pieceId: piece.id,
		mealId: piece.itemId,
		menuId: piece.menuId,
		mealName: piece.name,
		restaurantName,
		price: piece.price,
		state: piece.state,
		instructions: piece.instructions,
		selections: (piece.nonHiddenAttributes ?? []).map(
			(selection) => `${selection.label}: ${selection.value}`,
		),
	};
}

function summarizeDelivery(
	delivery: ForkableDelivery,
	menus: ForkableMenu[],
): DeliveryMeals {
	const restaurantMap = new Map<string, RestaurantMeals>();

	for (const menu of menus) {
		const restaurantName = menu.venue.displayName || menu.venue.name;
		let restaurant = restaurantMap.get(restaurantName);
		if (!restaurant) {
			restaurant = {
				restaurantName,
				meals: [],
			};
			restaurantMap.set(restaurantName, restaurant);
		}

		for (const section of menu.sections ?? []) {
			for (const item of section.items ?? []) {
				if (item.disabled) {
					continue;
				}
				restaurant.meals.push(mealToListEntry(item));
			}
		}
	}

	const restaurants = [...restaurantMap.values()]
		.map((restaurant) => ({
			...restaurant,
			meals: [...restaurant.meals].sort((left, right) => left.localeCompare(right)),
		}))
		.sort((left, right) => left.restaurantName.localeCompare(right.restaurantName));

	return {
		deliveryId: delivery.id,
		date: deliveryDate(delivery),
		locationId: delivery.mealClubId,
		locationName: locationName(delivery),
		isReadOnly: delivery.isReadOnly,
		restaurants,
	};
}

export class ForkableClient {
	constructor(
		private readonly sessionCookie: string,
		private readonly fetchImpl: typeof fetch = fetch,
	) {}

	private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const response = await this.fetchImpl(FORKABLE_API_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				origin: "https://forkable.com",
				"forkable-referrer": "mc",
				cookie: `_easyorder_session=${this.sessionCookie}`,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			throw new Error(`Forkable API request failed: ${response.status} ${response.statusText}`);
		}

		const result = (await response.json()) as GraphQLResponse<T>;
		if (result.errors?.length) {
			throw new Error(result.errors.map((error) => error.message).join("; "));
		}
		if (!result.data) {
			throw new Error("Forkable API returned no data");
		}
		return result.data;
	}

	async getViewer(): Promise<{ id: number; email: string }> {
		const data = await this.graphql<GraphQLMeResponse>(
			`query Viewer { me { id email } }`,
		);
		return data.me;
	}

	async getDeliveries(from: string): Promise<ForkableDelivery[]> {
		assertIsoDate(from);
		const data = await this.graphql<GraphQLDeliveriesResponse>(
			`
				query Deliveries($from: Date!) {
					myDeliveries(from: $from) {
						id
						forDeliveryAt
						isReadOnly
						mealClubId
						availableMenuIds
						address { formatted }
						club { id name }
						orders {
							pieces {
								id
								itemId
								menuId
								name
								price
								state
								instructions
								user { email }
								nonHiddenAttributes { label value }
							}
						}
					}
				}
			`,
			{ from },
		);
		return data.myDeliveries;
	}

	async getMenus(menuIds: number[], clubId: number): Promise<ForkableMenu[]> {
		if (menuIds.length === 0) {
			return [];
		}

		const data = await this.graphql<GraphQLMenusResponse>(
			`
				query Menus($menuIds: [Int!]!, $clubId: Int!) {
					menus(ids: $menuIds, clubId: $clubId) {
						id
						name
						displayName
						venue { id name displayName }
						sections {
							items {
								id
								menuId
								name
								description
								price
								averageRating
								disabled
								ingredientTags
								modifiers {
									id
									name
									min
									max
									free
									required
									hidden
									options {
										id
										name
										price
										ingredientTags
									}
								}
							}
						}
					}
				}
			`,
			{ menuIds, clubId },
		);
		return data.menus;
	}

	async getRestaurantsAndMealsForDate(date: string): Promise<DayMealsResult> {
		assertIsoDate(date);
		const deliveries = await this.getDeliveries(date);
		const matchingDeliveries = deliveries.filter((delivery) => deliveryDate(delivery) === date);
		const menuSets = await Promise.all(
			matchingDeliveries.map((delivery) =>
				this.getMenus(delivery.availableMenuIds, delivery.mealClubId),
			),
		);

		const summarizedDeliveries = matchingDeliveries
			.map((delivery, index) => summarizeDelivery(delivery, menuSets[index]))
			.sort((left, right) =>
				left.locationName === right.locationName
					? left.deliveryId - right.deliveryId
					: left.locationName.localeCompare(right.locationName),
			);

		const restaurantCount = summarizedDeliveries.reduce(
			(count, delivery) => count + delivery.restaurants.length,
			0,
		);
		const mealCount = summarizedDeliveries.reduce(
			(count, delivery) =>
				count + delivery.restaurants.reduce((restaurantCount, restaurant) => restaurantCount + restaurant.meals.length, 0),
			0,
		);

		return {
			date,
			deliveryCount: summarizedDeliveries.length,
			editableDeliveryCount: summarizedDeliveries.filter((delivery) => !delivery.isReadOnly).length,
			restaurantCount,
			mealCount,
			deliveries: summarizedDeliveries,
		};
	}

	async getCurrentOrderForDate(
		input: CurrentOrderForDateInput,
	): Promise<CurrentOrderForDateResult> {
		assertIsoDate(input.date);
		const viewer = await this.getViewer();
		const deliveries = (await this.getDeliveries(input.date))
			.filter((delivery) => deliveryDate(delivery) === input.date)
			.filter((delivery) =>
				deliveryMatchesLocationFilter(delivery, input.locationId, input.locationName),
			);

		const summarizedDeliveries = await Promise.all(
			deliveries.map(async (delivery) => {
				const existingOrder = existingOrderPieceForDelivery(delivery, viewer.email);
				let order: CurrentOrderSummary | null = null;

				if (existingOrder) {
					const menus = await this.getMenus(delivery.availableMenuIds, delivery.mealClubId);
					order = summarizeCurrentOrder(
						existingOrder,
						restaurantNameForOrderPiece(existingOrder, menus),
					);
				}

				return {
					deliveryId: delivery.id,
					date: deliveryDate(delivery),
					locationId: delivery.mealClubId,
					locationName: locationName(delivery),
					locationAddress: delivery.address.formatted,
					isReadOnly: delivery.isReadOnly,
					order,
				};
			}),
		);

		return {
			date: input.date,
			deliveryCount: summarizedDeliveries.length,
			orderCount: summarizedDeliveries.filter((delivery) => delivery.order !== null).length,
			deliveries: summarizedDeliveries.sort((left, right) =>
				left.locationName === right.locationName
					? left.deliveryId - right.deliveryId
					: left.locationName.localeCompare(right.locationName),
			),
		};
	}

	private async findCandidateMeals(input: OrderMealInput): Promise<CandidateMeal[]> {
		const deliveries = (await this.getDeliveries(input.date)).filter(
			(delivery) => deliveryDate(delivery) === input.date && !delivery.isReadOnly,
		);

		const filteredDeliveries = deliveries.filter((delivery) =>
			deliveryMatchesLocationFilter(delivery, input.locationId, input.locationName),
		);

		const menusByDelivery = await Promise.all(
			filteredDeliveries.map((delivery) => this.getMenus(delivery.availableMenuIds, delivery.mealClubId)),
		);

		const candidates: CandidateMeal[] = [];
		for (const [index, delivery] of filteredDeliveries.entries()) {
			for (const menu of menusByDelivery[index]) {
				if (input.menuId != null && menu.id !== input.menuId) {
					continue;
				}

				if (
					input.restaurantName &&
					!matchesBySubstring(menu.venue.name, input.restaurantName) &&
					!matchesBySubstring(menu.venue.displayName, input.restaurantName)
				) {
					continue;
				}

				for (const section of menu.sections ?? []) {
					for (const item of section.items ?? []) {
						if (item.disabled) {
							continue;
						}

						if (input.mealId != null && item.id !== input.mealId) {
							continue;
						}

						if (input.mealName && !matchesBySubstring(item.name, input.mealName)) {
							continue;
						}

						candidates.push({ delivery, menu, item });
					}
				}
			}
		}

		return candidates;
	}

	private buildSelectionsHash(
		item: ForkableMenuItem,
		selections: MealSelectionInput[] | null | undefined,
	): { selectionsHash: Record<string, number[]>; appliedSelections: Array<{ modifier: string; option: string }> } {
		const selectionsHash: Record<string, number[]> = {};
		const appliedSelections: Array<{ modifier: string; option: string }> = [];
		const missingRequired: string[] = [];

		for (const modifier of item.modifiers ?? []) {
			if (modifier.hidden) {
				continue;
			}

			const selection = selections?.find(
				(candidate) => normalized(candidate.modifier) === normalized(modifier.name),
			);
			if (!selection) {
				if (modifier.required) {
					missingRequired.push(
						`${modifier.name} (${modifier.options.map((option) => option.name).join(", ")})`,
					);
				}
				continue;
			}

			if (normalized(selection.option) === "none" || normalized(selection.option) === "no selection") {
				selectionsHash[String(modifier.id)] = [-1];
				appliedSelections.push({ modifier: modifier.name, option: "none" });
				continue;
			}

			const option = modifier.options.find(
				(candidate) => normalized(candidate.name) === normalized(selection.option),
			);
			if (!option) {
				throw new Error(
					`Unknown option "${selection.option}" for "${modifier.name}". Available options: ${modifier.options.map((candidate) => candidate.name).join(", ")}`,
				);
			}

			selectionsHash[String(modifier.id)] = [option.id];
			appliedSelections.push({ modifier: modifier.name, option: option.name });
		}

		if (missingRequired.length > 0) {
			throw new Error(`Missing required selections: ${missingRequired.join("; ")}`);
		}

		return { selectionsHash, appliedSelections };
	}

	async orderMealForDate(input: OrderMealInput): Promise<OrderMealResult> {
		assertIsoDate(input.date);

		if (!input.mealName && (input.mealId == null || input.menuId == null)) {
			return {
				success: false,
				message: "Provide either mealName or both mealId and menuId.",
				date: input.date,
				deliveryId: null,
				locationId: input.locationId ?? null,
				locationName: input.locationName ?? null,
				locationAddress: null,
				restaurantName: input.restaurantName ?? null,
				meal: null,
				appliedSelections: [],
				replacedExistingOrder: false,
			};
		}

		const candidates = await this.findCandidateMeals(input);
		if (candidates.length === 0) {
			return {
				success: false,
				message: `No editable meal matched the request for ${input.date}.`,
				date: input.date,
				deliveryId: null,
				locationId: input.locationId ?? null,
				locationName: input.locationName ?? null,
				locationAddress: null,
				restaurantName: input.restaurantName ?? null,
				meal: null,
				appliedSelections: [],
				replacedExistingOrder: false,
			};
		}

		if (candidates.length > 1) {
			const preview = candidates
				.slice(0, 5)
				.map(
					(candidate) =>
						`${candidate.item.name} @ ${candidate.menu.venue.displayName || candidate.menu.venue.name} (${locationName(candidate.delivery)}) [menuId=${candidate.menu.id}, mealId=${candidate.item.id}]`,
				)
				.join("; ");
			return {
				success: false,
				message: `Multiple meals matched the request. Narrow it with restaurantName, locationId/locationName, or exact mealId + menuId. Matches: ${preview}`,
				date: input.date,
				deliveryId: null,
				locationId: null,
				locationName: null,
				locationAddress: null,
				restaurantName: null,
				meal: null,
				appliedSelections: [],
				replacedExistingOrder: false,
			};
		}

		const [{ delivery, menu, item }] = candidates;
		const meal = mealToSummary(item);

		try {
			const viewer = await this.getViewer();
			const existingOrder = existingOrderPieceForDelivery(delivery, viewer.email);
			const { selectionsHash, appliedSelections } = this.buildSelectionsHash(item, input.selections);

			const data = await this.graphql<GraphQLReplacePieceResponse>(
				`
					mutation ReplacePiece($input: ReplacePieceInput!) {
						replacePiece(input: $input) {
							errors
							errorDetails
							delivery {
								id
								forDeliveryAt
								address { formatted }
								orders {
									pieces {
										id
										itemId
										menuId
										name
										price
										state
										instructions
										user { email }
										nonHiddenAttributes { label value }
									}
								}
							}
						}
					}
				`,
				{
					input: {
						deliveryId: delivery.id,
						itemId: item.id,
						menuId: menu.id,
						instructions: input.instructions ?? null,
						selectionsHash,
						myMeals: true,
						...(existingOrder ? { oldPieceId: existingOrder.id } : {}),
					},
				},
			);

			if (data.replacePiece.errors?.length) {
				return {
					success: false,
					message: `Order failed: ${data.replacePiece.errors.join(", ")}`,
					date: input.date,
					deliveryId: delivery.id,
					locationId: delivery.mealClubId,
					locationName: locationName(delivery),
					locationAddress: delivery.address.formatted,
					restaurantName: menu.venue.displayName || menu.venue.name,
					meal,
					appliedSelections,
					replacedExistingOrder: Boolean(existingOrder),
				};
			}

			return {
				success: true,
				message: `Ordered "${item.name}" for ${input.date} at ${locationName(delivery)}.`,
				date: input.date,
				deliveryId: delivery.id,
				locationId: delivery.mealClubId,
				locationName: locationName(delivery),
				locationAddress: delivery.address.formatted,
				restaurantName: menu.venue.displayName || menu.venue.name,
				meal,
				appliedSelections,
				replacedExistingOrder: Boolean(existingOrder),
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : String(error),
				date: input.date,
				deliveryId: delivery.id,
				locationId: delivery.mealClubId,
				locationName: locationName(delivery),
				locationAddress: delivery.address.formatted,
				restaurantName: menu.venue.displayName || menu.venue.name,
				meal,
				appliedSelections: [],
				replacedExistingOrder: false,
			};
		}
	}
}
