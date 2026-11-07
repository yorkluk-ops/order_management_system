CREATE TABLE `externalOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(32) NOT NULL,
	`externalOrderId` varchar(191) NOT NULL,
	`shopName` varchar(255) NOT NULL,
	`orderId` int,
	`status` enum('processing','completed') NOT NULL DEFAULT 'processing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `externalOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `externalOrders_platform_externalOrderId_unique` UNIQUE(`platform`,`externalOrderId`)
);
