export type PublishablePost = { caption: string; mediaUrl?: string };

export interface Publisher {
  name: string;
  capabilities(): { images: boolean; schedule: boolean };
  publish(post: PublishablePost): Promise<{ url?: string }>;
}
