CREATE TABLE `inventoryLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`shopId` int NOT NULL,
	`quantityChange` int NOT NULL,
	`quantityAfter` int NOT NULL,
	`changeType` enum('manual','purchase','transfer_in','transfer_out','order','order_cancel') NOT NULL,
	`referenceId` int,
	`referenceType` varchar(50),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`sku` varchar(64) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`color` varchar(100),
	`quantity` int NOT NULL,
	`unitCost` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poNumber` varchar(32) NOT NULL,
	`supplier` varchar(255) NOT NULL,
	`shopId` int NOT NULL,
	`orderDate` timestamp NOT NULL,
	`status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
	`pdfUrl` text,
	`totalAmount` decimal(12,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_poNumber_unique` UNIQUE(`poNumber`)
);
--> statement-breakpoint
CREATE TABLE `shopInventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`shopId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopInventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockTransferItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`sku` varchar(64) NOT NULL,
	`productName` varchar(255) NOT NULL,
	`color` varchar(100),
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockTransferItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferNumber` varchar(32) NOT NULL,
	`fromShopId` int NOT NULL,
	`toShopId` int NOT NULL,
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stockTransfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockTransfers_transferNumber_unique` UNIQUE(`transferNumber`)
);
