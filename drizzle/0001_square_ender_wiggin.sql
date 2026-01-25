CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(50) NOT NULL,
	`customerEmail` varchar(320),
	`packageId` int NOT NULL,
	`packageName` varchar(255) NOT NULL,
	`packageVariant` varchar(255),
	`orderAmount` decimal(10,2) NOT NULL,
	`commission` decimal(10,2) NOT NULL,
	`deliveryAddress` text NOT NULL,
	`deliveryDate` timestamp,
	`deliveryTimeSlot` varchar(50),
	`status` enum('pending','confirmed','delivering','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`commission` decimal(10,2) NOT NULL,
	`originalValue` decimal(10,2),
	`savings` varchar(100),
	`freeGift` text,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `packages_code_unique` UNIQUE(`code`)
);
