/** `postId` and `storeSlug` let a publisher build a link back to the post; Telegram ignores them. */
export type PublishablePost = { caption: string; mediaUrl?: string; postId: string; storeSlug: string };

export interface Publisher {
  name: string;
  capabilities(): { images: boolean; schedule: boolean };
  publish(post: PublishablePost): Promise<{ url?: string }>;
}
