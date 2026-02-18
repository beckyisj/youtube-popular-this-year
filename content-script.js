// YouTube Popular This Year Extension
// Content script that adds a "Popular This Year" filter to YouTube channel pages

class YouTubePopularThisYear {
  constructor() {
    this.isActive = false;
    this.originalVideos = [];
    this.filteredVideos = [];
    this.twelveMonthsAgo = new Date();
    this.twelveMonthsAgo.setMonth(this.twelveMonthsAgo.getMonth() - 12);
    this.observer = null;
    this.buttonAdded = false;
    this.waitObserver = null;

    this.init();
  }

  init() {
    console.log('YouTube Popular This Year: Extension initialized');
    console.log('YouTube Popular This Year: Current URL:', window.location.href);

    // Wait for page to load and check if we're on a channel page
    if (this.isChannelPage()) {
      console.log('YouTube Popular This Year: Channel page detected');
      this.waitForSortButtons();
      this.setupMutationObserver();
    } else {
      console.log('YouTube Popular This Year: Not a channel page');
    }
  }

  isChannelPage() {
    // Check if we're on a YouTube channel page
    return window.location.pathname.includes('/channel/') ||
           window.location.pathname.includes('/c/') ||
           window.location.pathname.includes('/user/') ||
           window.location.pathname.includes('/@');
  }

  waitForSortButtons() {
    // Try immediately first
    const sortContainer = document.querySelector('ytd-feed-filter-chip-bar-renderer #chips, yt-chip-cloud-modern, yt-chip-cloud, #chips-container');
    if (sortContainer) {
      this.addPopularThisYearButton();
      return;
    }

    // If not found, use a MutationObserver to wait for it
    this.waitObserver = new MutationObserver(() => {
      if (this.buttonAdded) {
        this.waitObserver.disconnect();
        this.waitObserver = null;
        return;
      }
      const container = document.querySelector('ytd-feed-filter-chip-bar-renderer #chips, yt-chip-cloud-modern, yt-chip-cloud, #chips-container');
      if (container) {
        this.waitObserver.disconnect();
        this.waitObserver = null;
        this.addPopularThisYearButton();
      }
    });

    this.waitObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupMutationObserver() {
    // Watch for changes to the page that might remove our button
    this.observer = new MutationObserver((mutations) => {
      let shouldReaddButton = false;

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.removedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if ((node.classList && node.classList.contains('popular-this-year-btn')) ||
              (node.querySelector && node.querySelector('.popular-this-year-btn'))) {
            console.log('YouTube Popular This Year: Button was removed, will re-add');
            shouldReaddButton = true;
            break;
          }
        }
        if (shouldReaddButton) break;
      }

      if (shouldReaddButton) {
        this.buttonAdded = false;
        // Wait a bit for YouTube to finish updating
        setTimeout(() => {
          this.addPopularThisYearButton();
        }, 100);
      }
    });

    // Start observing the document body for changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('YouTube Popular This Year: MutationObserver setup complete');
  }

  addPopularThisYearButton() {
    // Guard: only add once per cycle
    if (this.buttonAdded) return;

    // Look for video filter chips container specifically
    const sortContainer = document.querySelector('ytd-feed-filter-chip-bar-renderer #chips, yt-chip-cloud-modern, yt-chip-cloud, #chips-container');
    if (!sortContainer) {
      console.log('YouTube Popular This Year: Video filter chips container not found');
      return;
    }

    // Check if button already exists anywhere on page
    if (document.querySelector('.popular-this-year-btn')) {
      console.log('YouTube Popular This Year: Button already exists');
      this.buttonAdded = true;
      return;
    }

    console.log('YouTube Popular This Year: Adding button to chips container');

    // Create the button
    const button = document.createElement('button');
    button.className = 'popular-this-year-btn';
    button.textContent = this.isActive ? 'Show All Videos' : 'Popular This Year';
    if (this.isActive) {
      button.classList.add('active');
    }
    button.addEventListener('click', () => this.handlePopularThisYearClick());

    // Insert the button at the end of the chips container (last position)
    sortContainer.appendChild(button);
    this.buttonAdded = true;
    console.log('YouTube Popular This Year: Button added to chips container');
  }

  handlePopularThisYearClick() {
    console.log('YouTube Popular This Year: Button clicked');

    if (this.isActive) {
      this.resetToOriginal();
    } else {
      this.applyPopularThisYearFilter();
    }
  }

  applyPopularThisYearFilter() {
    // Store original videos
    this.originalVideos = this.extractVideoData();

    // Filter videos from past 12 months - only exclude videos we're confident are older
    this.filteredVideos = this.originalVideos.filter(video => {
      // If we couldn't parse the date, include the video rather than silently dropping it
      if (!video.uploadDate) return true;
      return video.uploadDate >= this.twelveMonthsAgo;
    });

    // Sort by view count (descending)
    this.filteredVideos.sort((a, b) => b.viewCount - a.viewCount);

    // Update the display
    this.updateVideoDisplay();

    this.isActive = true;

    // Update button state
    const button = document.querySelector('.popular-this-year-btn');
    if (button) {
      button.classList.add('active');
      button.textContent = 'Show All Videos';
    }
  }

  resetToOriginal() {
    // Restore original video order
    this.updateVideoDisplay(this.originalVideos);

    this.isActive = false;

    // Update button state
    const button = document.querySelector('.popular-this-year-btn');
    if (button) {
      button.classList.remove('active');
      button.textContent = 'Popular This Year';
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.waitObserver) {
      this.waitObserver.disconnect();
      this.waitObserver = null;
    }
    this.buttonAdded = false;
    console.log('YouTube Popular This Year: Cleaned up observers');
  }

  extractVideoData() {
    const videos = [];
    // Look for video elements in the main content area
    const videoElements = document.querySelectorAll('#contents ytd-rich-item-renderer, #contents ytd-video-renderer, ytd-rich-item-renderer, ytd-video-renderer');

    console.log('YouTube Popular This Year: Found', videoElements.length, 'video elements');

    videoElements.forEach((element, index) => {
      const videoData = this.parseVideoElement(element, index);
      if (videoData) {
        videos.push(videoData);
        console.log('YouTube Popular This Year: Parsed video:', videoData.title, 'Views:', videoData.viewCount, 'Date:', videoData.uploadDate);
      }
    });

    return videos;
  }

  parseVideoElement(element, index) {
    try {
      // Extract video title and link - try multiple selectors
      const titleElement = element.querySelector('#video-title, a#video-title, h3 a, ytd-video-meta-block a');
      if (!titleElement) {
        console.log('YouTube Popular This Year: No title element found for video', index);
        return null;
      }

      const title = titleElement.textContent.trim();
      const videoUrl = titleElement.href;

      // Extract view count and date from all text content
      const allText = element.textContent || '';

      // Try to find view count in the text
      const viewCountMatch = allText.match(/(\d+(?:[,.\s]\d+)*[kmb]?)\s*views?/i);
      let viewCount = 0;
      if (viewCountMatch) {
        viewCount = this.parseViewCount(viewCountMatch[1] + ' views');
      }

      // Try to find date in the text
      const dateMatch = allText.match(/(\d+\s*(?:hour|day|week|month|year)s?\s*ago)/i);
      let uploadDate = null;
      if (dateMatch) {
        uploadDate = this.parseUploadDate(dateMatch[1]);
      }

      return {
        element: element,
        title: title,
        url: videoUrl,
        viewCount: viewCount,
        uploadDate: uploadDate,
        originalIndex: index
      };
    } catch (error) {
      console.error('YouTube Popular This Year: Error parsing video element:', error);
      return null;
    }
  }

  parseViewCount(viewCountText) {
    if (!viewCountText) return 0;

    // Remove common words and clean the text
    let text = viewCountText.toLowerCase()
      .replace(/views?/g, '')
      .replace(/,/g, '')
      .trim();

    if (text.includes('k')) {
      const num = parseFloat(text.replace('k', ''));
      return isNaN(num) ? 0 : Math.floor(num * 1000);
    } else if (text.includes('m')) {
      const num = parseFloat(text.replace('m', ''));
      return isNaN(num) ? 0 : Math.floor(num * 1000000);
    } else if (text.includes('b')) {
      const num = parseFloat(text.replace('b', ''));
      return isNaN(num) ? 0 : Math.floor(num * 1000000000);
    } else {
      const num = parseFloat(text);
      return isNaN(num) ? 0 : Math.floor(num);
    }
  }

  parseUploadDate(dateText) {
    if (!dateText) return null;

    const text = dateText.toLowerCase();
    const now = new Date();

    if (text.includes('hour')) {
      const hours = parseInt(text.match(/\d+/)?.[0] || '0');
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (text.includes('day')) {
      const days = parseInt(text.match(/\d+/)?.[0] || '0');
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (text.includes('week')) {
      const weeks = parseInt(text.match(/\d+/)?.[0] || '0');
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    } else if (text.includes('month')) {
      const months = parseInt(text.match(/\d+/)?.[0] || '0');
      // Use proper month subtraction instead of approximating 30 days
      const date = new Date(now);
      date.setMonth(date.getMonth() - months);
      return date;
    } else if (text.includes('year')) {
      const years = parseInt(text.match(/\d+/)?.[0] || '0');
      // Use proper year subtraction instead of approximating 365 days
      const date = new Date(now);
      date.setFullYear(date.getFullYear() - years);
      return date;
    }

    console.log('YouTube Popular This Year: Could not parse date:', dateText);
    return null;
  }

  updateVideoDisplay(videos = this.filteredVideos) {
    // Find the correct video container - be specific to avoid clearing non-video content
    const container = document.querySelector('ytd-rich-grid-renderer #contents, ytd-section-list-renderer #contents, #contents');
    if (!container) return;

    // Remove only the video elements instead of clearing everything with innerHTML
    const existingVideos = container.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    existingVideos.forEach(el => el.remove());

    // Re-add videos in the desired order
    // Insert before the first non-video child (like continuation elements) or append
    const firstNonVideo = container.querySelector(':scope > :not(ytd-rich-item-renderer):not(ytd-video-renderer)');
    videos.forEach(video => {
      if (firstNonVideo) {
        container.insertBefore(video.element, firstNonVideo);
      } else {
        container.appendChild(video.element);
      }
    });
  }
}

// Track the current instance so we can clean it up on SPA navigation
let currentInstance = null;

// Initialize the extension when the page loads
function initExtension() {
  if (currentInstance) {
    currentInstance.cleanup();
  }
  currentInstance = new YouTubePopularThisYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}

// Re-initialize on navigation (for SPA behavior)
let currentUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    // Clean up old instance before creating a new one
    if (currentInstance) {
      currentInstance.cleanup();
      currentInstance = null;
    }
    // Remove any leftover buttons
    document.querySelectorAll('.popular-this-year-btn').forEach(btn => btn.remove());
    // Small delay to let the page load
    setTimeout(() => {
      currentInstance = new YouTubePopularThisYear();
    }, 1000);
  }
});

urlObserver.observe(document.body, {
  childList: true,
  subtree: true
});
