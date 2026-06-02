/**
 * BetterAuth tables — ADDITIVE, separate from the existing app schema.
 *
 * These tables back the BetterAuth second auth path used by the mobile app.
 * They are intentionally kept OUT of `schema.ts` so the existing app schema
 * (and its generated migration metadata) stays untouched.
 *
 * The `auth_household_link` bridge table maps a BetterAuth user to a household
 * (the unit by which all app data is keyed). It references `households.id` from
 * the existing schema so the two auth paths converge on the same household data.
 */
import { pgTable, text, uuid, boolean, timestamp } from 'drizzle-orm/pg-core'
import { households } from './schema.js'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Bridge: links a BetterAuth user to a household. One household per user (PK on
 * userId). A fresh household created on first BetterAuth login simply has no
 * preferences yet — allergies / hardRestrictions stay empty (HARD CONSTRAINTS
 * are respected: nothing is ever violated by an empty set).
 */
export const authHouseholdLink = pgTable('auth_household_link', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type AuthUser = typeof user.$inferSelect
export type NewAuthUser = typeof user.$inferInsert
export type AuthSession = typeof session.$inferSelect
export type NewAuthSession = typeof session.$inferInsert
export type AuthAccount = typeof account.$inferSelect
export type NewAuthAccount = typeof account.$inferInsert
export type AuthVerification = typeof verification.$inferSelect
export type NewAuthVerification = typeof verification.$inferInsert
export type AuthHouseholdLink = typeof authHouseholdLink.$inferSelect
export type NewAuthHouseholdLink = typeof authHouseholdLink.$inferInsert
