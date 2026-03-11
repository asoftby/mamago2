// Admin-specific types for client components
// These mirror Prisma enums but are safe to use in client components

export enum UserStatus {
  ACTIVE = "ACTIVE",
  LIMITED = "LIMITED",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
}

export enum UserModerationActionType {
  WARN = "WARN",
  LIMIT = "LIMIT",
  SUSPEND = "SUSPEND",
  BAN = "BAN",
  UNBAN = "UNBAN",
  ROLE_CHANGE = "ROLE_CHANGE",
}

export enum Role {
  USER = "USER",
  BUSINESS_OWNER = "BUSINESS_OWNER",
  MODERATOR = "MODERATOR",
  ADMIN = "ADMIN",
}
