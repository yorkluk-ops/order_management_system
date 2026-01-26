CREATE TABLE `orderPackages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`packageId` int,
	`packageCode` varchar(32) NOT NULL,
	`packageName` varchar(255) NOT NULL,
	`packageVariant` varchar(255),
	`price` decimal(10,2) NOT NULL,
	`commission` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderPackages_id` PRIMARY KEY(`id`)
);
