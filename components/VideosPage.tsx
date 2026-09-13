import React, { useState, useMemo, useRef } from 'react';
import { InstagramVideoCard } from './InstagramVideoCard';
import { safeUserId, avatarFrom } from './Feed';

interface VideosPageProps {
  posts?: any[];
  reels?: any[];
  users?: any[];
  stories?: any[];
  currentUser: any;
  onPostVideoClick: () => void;
  onProfileClick: (userId: number) => void;
  onStoryClick?: (userId: number) => void;
  onReact?: (post: any, type: string) => void;
  onShare?: (postId: number, count: number) => void;
  onFollow?: (userId: number) => void;
  checkIsFollowing?: (userId: number) => boolean;
  onBack?: () => void;
}

const VIDEOS_PER_PAGE = 15;

export const VideosPage: React.FC<VideosPageProps> = ({
  posts = [],
  reels = [],
  users = [],
  stories = [],
  currentUser,
  onPostVideoClick,
  onProfileClick,
  onStoryClick,
  onReact,
  onShare,
  onFollow,
  checkIsFollowing,
  onBack,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract, normalize, and unify ALL videos from feed posts and reels
  const allVideos = useMemo(() => {
    const videoMap = new Map<string, any>();

    // 1. Process feed posts that are videos
    posts.forEach((post) => {
      const isVideo =
        post?.media_type === 'video' ||
        post?.type === 'video' ||
        post?.meta?.type === 'video' ||
        (typeof post?.media_url === 'string' && post.media_url.match(/\.(mp4|webm|mov|m4v|ogg)/i)) ||
        Boolean(post?.video_url);

      if (isVideo) {
        const key = post?.media_url || post?.video_url || `post_${post?.id}`;
        if (!videoMap.has(key)) {
          videoMap.set(key, {
            ...post,
            source: 'post',
            video_url: post?.video_url || post?.media_url,
            media_url: post?.media_url || post?.video_url,
            created_at: post?.created_at || new Date().toISOString(),
          });
        }
      }
    });

    // 2. Process reels
    reels.forEach((reel) => {
      const vUrl = reel?.video_url || reel?.media_url;
      if (!vUrl) return;

      const key = vUrl;
      // If not already included from a feed post, add it
      if (!videoMap.has(key)) {
        const reelAuthor = reel?.user || users.find((u) => u.id === (reel?.user_id || reel?.userId)) || {
          id: reel?.user_id || 0,
          name: reel?.author || reel?.username || 'User',
          profile_image_url: reel?.avatar || reel?.profile_image_url,
          is_verified: Boolean(reel?.verified || reel?.is_verified),
        };

        videoMap.set(key, {
          id: reel?.id || `reel_${Date.now()}_${Math.random()}`,
          reel_id: reel?.id,
          content: reel?.caption || reel?.content || '',
          caption: reel?.caption || '',
          media_url: vUrl,
          video_url: vUrl,
          media_type: 'video',
          type: 'video',
          created_at: reel?.created_at || new Date().toISOString(),
          author: reelAuthor,
          user: reelAuthor,
          user_id: safeUserId(reelAuthor),
          likes_count: reel?.likes_count ?? reel?.views ?? 0,
          comments_count: reel?.comments_count ?? 0,
          shares_count: reel?.shares_count ?? 0,
          source: 'reel',
          song_name: reel?.song_name || reel?.audio_title,
        });
      }
    });

    // Convert map to array and sort chronologically (newest first)
    const list = Array.from(videoMap.values());
    list.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [posts, reels, users]);

  // Pagination calculation: 15 videos per page
  const totalVideos = allVideos.length;
  const totalPages = Math.max(1, Math.ceil(totalVideos / VIDEOS_PER_PAGE));
  const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
  const endIndex = Math.min(startIndex + VIDEOS_PER_PAGE, totalVideos);
  const currentVideos = allVideos.slice(startIndex, endIndex);

  // Handle page change and smooth scroll to top of list
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div ref={containerRef} className="w-full max-w-[700px] mx-auto min-h-screen pb-20">
      {/* 1. TOP HEADER - PROFESSIONAL "POST VIDEO" BAR */}
      <div className="bg-[#0B1120] border-b border-[#1E293B] sticky top-14 z-30 px-3.5 py-3 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors"
                aria-label="Back"
              >
                <i className="fas fa-arrow-left text-[13px]"></i>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#EC4899] to-[#8B5CF6] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <i className="fas fa-play text-[13px]"></i>
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-[#F8FAFC] leading-none">Videos</h1>
              <span className="text-[12px] text-[#94A3B8]">
                {totalVideos} {totalVideos === 1 ? 'video' : 'videos'} posted
              </span>
            </div>
          </div>

          {/* "+ Post Video" Button */}
          <button
            onClick={onPostVideoClick}
            type="button"
            className="flex items-center gap-2 bg-gradient-to-r from-[#1877F2] to-[#166FE5] hover:from-[#166FE5] hover:to-[#0D5BC6] text-white text-[13.5px] font-semibold px-4 py-2 rounded-xl shadow-[0_2px_10px_rgba(24,119,242,0.35)] active:scale-95 transition-all cursor-pointer"
          >
            <i className="fas fa-video text-[13px]"></i>
            <span>Post Video</span>
          </button>
        </div>

        {/* Quick Post Prompt bar if logged in */}
        {currentUser && (
          <div
            onClick={onPostVideoClick}
            className="mt-3 flex items-center gap-3 p-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] border border-[#1E293B] transition-colors cursor-pointer"
          >
            <img
              src={avatarFrom(currentUser)}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-[#334155]"
            />
            <span className="text-[13px] text-[#94A3B8] flex-1">
              Share a video to feed and reels...
            </span>
            <span className="text-xs font-semibold text-[#38BDF8] px-2.5 py-1 bg-[#0284C7]/15 rounded-lg border border-[#38BDF8]/30">
              Upload
            </span>
          </div>
        )}
      </div>

      {/* 2. VIDEOS FEED - ONLY VIDEOS USING INSTAGRAM VIDEO CARD */}
      {currentVideos.length > 0 ? (
        <div className="flex flex-col divide-y divide-[#1E293B]">
          {currentVideos.map((videoPost, idx) => {
            const author =
              videoPost.author ||
              videoPost.user ||
              users.find((u) => u.id === (videoPost.user_id || videoPost.userId)) || {
                id: videoPost.user_id || 0,
                name: 'User',
                profile_image_url: null,
                is_verified: false,
              };

            const authorId = safeUserId(author);
            const isFollowing = checkIsFollowing ? checkIsFollowing(authorId) : false;

            return (
              <div key={videoPost.id || `v_${idx}`} className="w-full bg-[#0F172A]">
                <InstagramVideoCard
                  post={videoPost}
                  author={author}
                  currentUser={currentUser}
                  users={users}
                  stories={stories}
                  onProfileClick={onProfileClick}
                  onStoryClick={onStoryClick}
                  onReact={onReact ? (postId, type) => onReact(videoPost, type) : undefined}
                  onShare={onShare}
                  isFollowing={isFollowing}
                  onFollow={onFollow}
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 text-center my-10">
          <div className="w-20 h-20 rounded-full bg-[#0F172A] border border-[#1E293B] flex items-center justify-center text-[#64748B] mb-4">
            <i className="fas fa-film text-3xl text-[#38BDF8]"></i>
          </div>
          <h3 className="text-lg font-bold text-[#F8FAFC]">No Videos Posted Yet</h3>
          <p className="text-sm text-[#94A3B8] max-w-sm mt-1 mb-5">
            Be the first to share a video with the UNERA community. Videos are posted to both feed and reels!
          </p>
          <button
            onClick={onPostVideoClick}
            type="button"
            className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <i className="fas fa-video"></i>
            <span>Post First Video</span>
          </button>
        </div>
      )}

      {/* 3. PAGINATION AFTER 15 VIDEOS */}
      {totalPages > 1 && (
        <div className="mt-6 mb-10 px-4 py-4 bg-[#0B1120] border border-[#1E293B] rounded-2xl mx-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[#94A3B8] font-medium">
            Showing <strong className="text-[#F8FAFC]">{startIndex + 1}–{endIndex}</strong> of{' '}
            <strong className="text-[#F8FAFC]">{totalVideos}</strong> videos
          </span>

          <div className="flex items-center gap-1.5">
            {/* Previous button */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                currentPage === 1
                  ? 'text-[#475569] bg-[#0F172A] border border-[#1E293B]/60 cursor-not-allowed'
                  : 'text-[#CBD5E1] bg-[#1E293B] hover:bg-[#334155] border border-[#334155]'
              }`}
            >
              <i className="fas fa-chevron-left text-[10px]"></i>
              <span>Prev</span>
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Show only nearby pages if there are many
              if (
                totalPages > 6 &&
                pageNum !== 1 &&
                pageNum !== totalPages &&
                Math.abs(pageNum - currentPage) > 1
              ) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return (
                    <span key={`ellipsis_${pageNum}`} className="px-1 text-xs text-[#64748B]">
                      …
                    </span>
                  );
                }
                return null;
              }

              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30'
                      : 'bg-[#0F172A] hover:bg-[#1E293B] text-[#94A3B8] border border-[#1E293B]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next button */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                currentPage === totalPages
                  ? 'text-[#475569] bg-[#0F172A] border border-[#1E293B]/60 cursor-not-allowed'
                  : 'text-[#CBD5E1] bg-[#1E293B] hover:bg-[#334155] border border-[#334155]'
              }`}
            >
              <span>Next</span>
              <i className="fas fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
