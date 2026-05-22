CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('planner','researcher','writer','coder','reviewer') NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('idle','active','paused','error') NOT NULL DEFAULT 'idle',
	`currentMissionId` int,
	`currentTask` text,
	`tokensUsed` bigint NOT NULL DEFAULT 0,
	`tasksCompleted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`missionId` int,
	`type` enum('terminal_command','file_delete','external_submission','deployment','github_write','browser_action','plan_approval') NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text NOT NULL,
	`payload` json NOT NULL,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`decidedBy` int,
	`decisionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`decidedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `browser_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`missionId` int,
	`url` varchar(2048) NOT NULL,
	`objective` text NOT NULL,
	`status` enum('pending','running','awaiting_approval','completed','failed','takeover_required') NOT NULL DEFAULT 'pending',
	`observations` json,
	`currentScreenshotUrl` varchar(2048),
	`requiresTakeover` boolean NOT NULL DEFAULT false,
	`takeoverReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `browser_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`missionId` int,
	`name` varchar(512) NOT NULL,
	`provider` enum('manus','vercel','netlify','railway','custom') NOT NULL DEFAULT 'manus',
	`status` enum('pending','building','deploying','live','failed','rolled_back') NOT NULL DEFAULT 'pending',
	`url` varchar(2048),
	`branch` varchar(255),
	`commitSha` varchar(64),
	`logs` json,
	`environmentVars` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `github_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int,
	`owner` varchar(255) NOT NULL,
	`repo` varchar(255) NOT NULL,
	`repoUrl` varchar(2048) NOT NULL,
	`defaultBranch` varchar(255) NOT NULL DEFAULT 'main',
	`activeBranch` varchar(255) NOT NULL DEFAULT 'main',
	`accessToken` varchar(1024),
	`status` enum('connected','disconnected','error') NOT NULL DEFAULT 'connected',
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `github_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int,
	`missionId` int,
	`type` enum('learning','preference','fact','instruction','artifact_summary') NOT NULL,
	`key` varchar(512) NOT NULL,
	`value` text NOT NULL,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memory_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`agentRole` varchar(64),
	`type` enum('thought','action','tool_call','terminal','file_write','browser','approval_request','approval_decision','status_change','error','summary') NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mission_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`goal` text NOT NULL,
	`status` enum('draft','planning','awaiting_approval','executing','paused','completed','failed') NOT NULL DEFAULT 'draft',
	`plan` json,
	`summary` text,
	`errorMessage` text,
	`agentRoles` json,
	`tokensUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `terminal_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`command` text NOT NULL,
	`riskLevel` enum('safe','moderate','destructive') NOT NULL DEFAULT 'safe',
	`status` enum('pending_approval','approved','rejected','running','completed','failed') NOT NULL DEFAULT 'running',
	`output` text,
	`exitCode` int,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `terminal_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `terminal_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`missionId` int,
	`name` varchar(255) NOT NULL,
	`status` enum('open','closed','error') NOT NULL DEFAULT 'open',
	`workingDirectory` varchar(1024) NOT NULL DEFAULT '/workspace',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`closedAt` timestamp,
	CONSTRAINT `terminal_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`missionId` int,
	`name` varchar(512) NOT NULL,
	`path` varchar(2048) NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`storageUrl` varchar(2048) NOT NULL,
	`size` bigint NOT NULL DEFAULT 0,
	`mimeType` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
