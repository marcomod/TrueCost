CREATE TABLE `ghost_cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`price` real NOT NULL,
	`price_mode` text NOT NULL,
	`image_url` text NOT NULL,
	`ghosted_at` integer NOT NULL
);
