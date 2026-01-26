ALTER TABLE `orderProducts` ADD `isGift` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `stockHK` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `stockCN` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `isGift` enum('yes','no') DEFAULT 'no' NOT NULL;