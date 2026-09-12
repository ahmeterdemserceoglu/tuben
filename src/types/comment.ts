export interface CommentItem {
  id: string;
  authorName: string;
  authorThumbnail: string;
  commentText: string;
  likeCount: number;
  uploadDate: string;
  repliesCount?: number;
  repliesToken?: string;
  isHeartedByUploader?: boolean;
  isPinned?: boolean;
}
