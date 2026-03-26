const ApiUrl = "https://api.superlio.ai"; //API URL

// ========== LINKEDIN ANALYTICS: Cookie Extraction Helper ==========
// Used for Voyager API calls (My Analytics feature)
// Extracts li_at and JSESSIONID cookies required for authenticated API requests

/**
 * Extracts LinkedIn authentication cookies for Voyager API calls
 * @returns {Promise<{success: boolean, cookies?: {li_at: string, csrfToken: string}, error?: string}>}
 */
const getLinkedInCookies = async () => {
  try {
    // Extract li_at cookie (session token)
    const liAtCookie = await new Promise((resolve) => {
      chrome.cookies.get(
        { url: "https://www.linkedin.com", name: "li_at" },
        (cookie) => resolve(cookie)
      );
    });

    // Extract JSESSIONID cookie (used as CSRF token)
    const jsessionCookie = await new Promise((resolve) => {
      chrome.cookies.get(
        { url: "https://www.linkedin.com", name: "JSESSIONID" },
        (cookie) => resolve(cookie)
      );
    });

    // Validate both cookies exist
    if (!liAtCookie || !liAtCookie.value) {
      return { success: false, error: "Not logged in to LinkedIn" };
    }

    if (!jsessionCookie || !jsessionCookie.value) {
      return { success: false, error: "LinkedIn session invalid" };
    }

    // Clean JSESSIONID (remove surrounding quotes if present)
    const csrfToken = jsessionCookie.value.replace(/"/g, "");

    // Store in chrome.storage.local for persistence
    await chrome.storage.local.set({
      linkedin_li_at: liAtCookie.value,
      linkedin_csrf_token: csrfToken,
      linkedin_cookies_updated_at: new Date().toISOString()
    });


    return {
      success: true,
      cookies: {
        li_at: liAtCookie.value,
        csrfToken: csrfToken
      }
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Makes authenticated requests to LinkedIn's Voyager API
 * @param {string} url - Full Voyager API URL
 * @param {Object} options - Optional fetch options
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
const fetchLinkedIn = async (url, options = {}) => {
  try {
    // Get cookies (from cache or fresh extraction)
    const cookieResult = await getLinkedInCookies();

    if (!cookieResult.success) {
      return { success: false, error: cookieResult.error };
    }

    const { li_at, csrfToken } = cookieResult.cookies;

    // Build headers for Voyager API
    const headers = {
      "csrf-token": csrfToken,
      "x-restli-protocol-version": "2.0.0",
      "x-li-lang": "en_US",
      ...options.headers
    };


    const response = await fetch(url, {
      method: options.method || "GET",
      headers: headers,
      credentials: "include",
      ...options
    });

    if (!response.ok) {
      return {
        success: false,
        error: `LinkedIn API error: ${response.status}`,
        status: response.status
      };
    }

    const data = await response.json();

    return { success: true, data };

  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ========== GRAPHQL FETCH HELPER ==========
// Fetches data from LinkedIn Voyager GraphQL API with proper variable encoding
// LinkedIn uses a special format: (key:value,key2:value2) instead of JSON
const fetchLinkedInGraphQL = async (queryId, variables = {}) => {
  try {
    // Convert variables object to LinkedIn's special format: (key:value,key2:value2)
    // Example: { count: 100, start: 0, profileUrn: "urn:li:..." } 
    //       -> "(count:100,start:0,profileUrn:urn%3Ali%3A...)"
    const formatVariables = (vars) => {
      const parts = Object.entries(vars).map(([key, value]) => {
        // Handle string values that need to be kept as-is (like URNs)
        if (typeof value === 'string') {
          return `${key}:${encodeURIComponent(value)}`;
        }
        return `${key}:${value}`;
      });
      return `(${parts.join(',')})`;
    };

    const variablesStr = formatVariables(variables);
    const url = `https://www.linkedin.com/voyager/api/graphql?queryId=${queryId}&variables=${variablesStr}`;


    return await fetchLinkedIn(url);

  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Test function for GraphQL fetch - can be called to verify it works
const testGraphQLFetch = async (profileUrn) => {

  // Use the Comments query ID discovered from research
  const COMMENTS_QUERY_ID = "voyagerFeedDashProfileUpdates.8f05a4e5ad12d9cb2b56eaa22afbcab9";

  const result = await fetchLinkedInGraphQL(COMMENTS_QUERY_ID, {
    count: 10,
    start: 0,
    profileUrn: profileUrn
  });

  if (result.success) {
    return { success: true, message: "GraphQL fetch working correctly", data: result.data };
  } else {
    return { success: false, error: result.error };
  }
};

// ========== COMMENTS FETCHING ==========
const COMMENTS_QUERY_ID = "voyagerFeedDashProfileUpdates.8f05a4e5ad12d9cb2b56eaa22afbcab9";

// Fetch all user comments with dynamic pagination and safety limits
// Fetch all user comments with dynamic pagination and safety limits
const fetchAllUserComments = async (profileUrn) => {
  const debugLogs = [];
  const log = (msg) => {
    debugLogs.push(msg);
  };

  log(`[Superlio Analytics] 📥 Starting comments fetch for: ${profileUrn}`);
  const allComments = [];
  let start = 0;
  const count = 50; // Batch size
  let hasMore = true;
  let iterations = 0;
  const MAX_ITERATIONS = 14; // Safety limit (max 700 comments)
  let paginationToken = null; // NEW: Track pagination token

  // Rate limiting check - DISABLED FOR DEBUGGING
  // const { lastCommentsFetchTime } = await chrome.storage.local.get("lastCommentsFetchTime");
  // if (lastCommentsFetchTime && (Date.now() - lastCommentsFetchTime < 5 * 60 * 1000)) {
  //    log("[Superlio Analytics] ⏳ Throttling comments fetch (fetched < 5 mins ago)");
  //    // return { comments: [], debug: debugLogs };
  // }

  while (hasMore && iterations < MAX_ITERATIONS) {
    iterations++;
    log(`[Superlio Analytics] 🔄 Fetching comments batch ${iterations} (start: ${start}, token: ${paginationToken ? 'present' : 'none'})...`);

    // Safety: Shorter delay (0.3-0.8s) between batches to prevent timeout
    if (iterations > 1) {
      const delay = 300 + Math.floor(Math.random() * 500);
      await new Promise(r => setTimeout(r, delay));
    }

    // Build variables with optional paginationToken
    const variables = {
      count: count,
      start: start,
      profileUrn: profileUrn
    };
    if (paginationToken) {
      variables.paginationToken = paginationToken;
    }

    const result = await fetchLinkedInGraphQL(COMMENTS_QUERY_ID, variables);

    if (!result.success) {
      log(`[Superlio Analytics] ⚠️ Failed to fetch comments batch: ${result.error}`);
      break;
    }

    // GraphQL response structure: result.data.data.feedDashProfileUpdatesByMemberComments
    let elements = result.data?.elements;
    let root = null;

    // Check for nested GraphQL 'data' key
    if (!elements && result.data?.data) {
      root = result.data.data.voyagerFeedDashProfileUpdates || result.data.data.feedDashProfileUpdatesByMemberComments;
      if (root && root.elements) {
        elements = root.elements;
        log("[Superlio Analytics] ✅ Found elements in nested GraphQL response");
      } else {
        log(`[Superlio Analytics] ⚠️ Found 'data' key but failed to locate elements. Keys in data: ${Object.keys(result.data.data)}`);
      }
    }

    if (!elements) {
      log(`[Superlio Analytics] ⚠️ Result data/elements missing. Top Keys: ${Object.keys(result.data || {})}`);
      break;
    }

    // Extract paginationToken for next request
    const newPaginationToken = root?.paging?.metadata?.paginationToken
      || root?.metadata?.paginationToken
      || result.data?.paging?.metadata?.paginationToken
      || result.data?.metadata?.paginationToken
      || null;

    log(`[Superlio Analytics] 📝 Pagination token: ${newPaginationToken ? 'found' : 'NOT FOUND'}`);

    const newComments = elements;
    log(`[Superlio Analytics] Found ${newComments.length} comments in batch.`);

    if (newComments.length === 0) {
      log("[Superlio Analytics] ⏹️ No more comments found (empty batch).");
      hasMore = false;
      break;
    }

    // Deduplicate comments
    const uniqueBatch = [];
    const seenUrns = new Set(allComments.map(c => c.urn || c.entityUrn || c.id));

    for (const comment of elements) {
      const id = comment.urn || comment.entityUrn || comment.id;
      if (id && !seenUrns.has(id)) {
        uniqueBatch.push(comment);
        seenUrns.add(id);
      } else if (!id) {
        uniqueBatch.push(comment);
      }
    }

    log(`[Superlio Analytics] Batch processed: ${uniqueBatch.length} unique new comments.`);

    if (uniqueBatch.length === 0) {
      log("[Superlio Analytics] ⏹️ No NEW comments found (all duplicates). Stopping fetch.");
      hasMore = false;
      break;
    }

    // Add unique batch to total
    allComments.push(...uniqueBatch);

    // Update pagination for next iteration
    if (newPaginationToken) {
      paginationToken = newPaginationToken;
      start += count; // Also increment start as backup
    } else {
      // No pagination token means no more pages
      log("[Superlio Analytics] ⏹️ No pagination token returned. Assuming end of results.");
      hasMore = false;
    }
  }

  log(`[Superlio Analytics] ✅ Comments Fetch Complete. Total raw items: ${allComments.length}`);
  await chrome.storage.local.set({ lastCommentsFetchTime: Date.now() });

  return { comments: allComments, debug: debugLogs };
};

// ========== PARSE COMMENTS DATA ==========
// Extracts structured data from raw GraphQL comment elements
const parseCommentsData = (rawComments, userProfileUrn) => {

  // DEBUG: Log the full structure of the first comment to find the correct paths
  if (rawComments.length > 0) {
  }

  const parsedComments = rawComments.map(comment => {
    // Check if this is a comment on user's own post
    // Compare: Post Author URN vs Commenter URN (both are urn:li:member:XXXX format)
    const postAuthorUrn = comment.actor?.backendUrn; // e.g., "urn:li:member:1091491200"
    const commenterUrn = comment.highlightedComments?.[0]?.commenter?.urn; // e.g., "urn:li:member:1091491200"
    const isOwnPost = postAuthorUrn && commenterUrn && postAuthorUrn === commenterUrn;

    // Extract URN/ID (Prioritize highlighted comment URN)
    const urn = comment.highlightedComments?.[0]?.entityUrn || comment.urn || comment.entityUrn || comment.id || null;

    // Extract comment text
    // Based on the raw sample, the "content" of the comment seems to be in `comment.content` or `comment.commentary`
    // The previous text was the POST text. The actual comment text is in `comment.commentary.text.text` 
    // BUT checking the sample again: 
    // `commentary` has `text.text`.
    // The sample shows `commentary` has `text` which is a `TextViewModel`.
    // Let's try to look for the user's comment specifically.
    // In some views, the user's comment is in `highlightedComments[0].comment.values[0].text`?
    // No, structurally:
    // `comment.commentary.text.text` seems to be the POST text (e.g. "Someone asked me yesterday...").
    // The user's comment ("Honest timelines...") is likely in `comment.header` or `comment.content` or `comment.commentary` if it's a direct comment object.
    // WAIT. The object in the sample is of type `com.linkedin.voyager.dash.feed.Update`.
    // It seems we are fetching "Updates" (posts) that the user commented on, wrapped as an update.
    // The actual comment might be in `comment.commentary` IF the update type is a "Comment".
    // But here the update seems to be the ORIGINAL POST ("Someone asked me yesterday").
    // And the user's comment is attached.
    // Look at `highlightedComments`.

    // Check highlightedComments first (User's comment on the post)
    let text = "";
    if (comment.highlightedComments && comment.highlightedComments.length > 0) {
      const hc = comment.highlightedComments[0];

      // Path confirmed via screenshot: hc.commentary.text is a DIRECT string property
      // NOT hc.commentary.text.text (text is not nested under another text object)
      text = hc.commentary?.text ||
        hc.comment?.values?.[0]?.text ||
        hc.text ||
        "";
    }

    // If not found, try the main commentary (fallback)
    if (!text) {
      text = comment.commentary?.text?.text
        || comment.commentaryText?.text
        || comment.text?.text
        || comment.text
        || "";
    }

    // Extract date/timestamp
    let dateText = comment.actor?.subDescription?.text
      || comment.subDescription?.text
      || "";

    // Correct Date from highlighted entry (Timestamp)
    if (comment.highlightedComments?.[0]?.createdAt) {
      const diff = Date.now() - comment.highlightedComments[0].createdAt;
      const days = Math.floor(diff / (86400000));
      dateText = days > 0 ? `${days}d` : `${Math.floor(diff / 3600000)}h`;
    } else if (!dateText && comment.createdAt) {
      dateText = String(comment.createdAt);
    }

    // Extract impressions count 
    // In the screenshot, "24 impressions" is visible next to "Reply".
    // This is often in `socialDetail.totalSocialActivityCounts.numImpressions` OR
    // specific to the comment.
    // The sample shows `socialDetail` for the POST (with `urn:li:activity:...`).
    // If this is a wrapper Update, the comment's metrics might be deeper.
    // Let's try to find "24" in the raw object via the console log user sent... they didn't send the full nested object.

    let impressions = 0;
    let likes = 0;

    // Check highlightedComments for metrics (the comment itself)
    if (comment.highlightedComments && comment.highlightedComments.length > 0) {
      const commentNode = comment.highlightedComments[0];
      // Sometimes hidden in socialDetail of the comment node
      impressions = commentNode.socialDetail?.totalSocialActivityCounts?.numImpressions || 0;
      // Try multiple paths for comment likes/reactions
      likes = commentNode.socialDetail?.totalSocialActivityCounts?.numLikes
        || commentNode.numLikes
        || commentNode.reactionCount
        || 0;
    }

    // Fallback to top-level metrics if 0 for IMPRESSIONS ONLY
    // We don't fallback for likes because that would show the parent post's likes
    if (impressions === 0) {
      impressions = comment.socialDetail?.totalSocialActivityCounts?.numImpressions
        || comment.numImpressions
        || comment.impressions
        || 0;
    }
    // DO NOT fallback likes to parent post metrics - that shows wrong data

    // Extract the URL to the original post (if available)
    const postUrl = comment.updateMetadata?.actions?.find(a => a.actionType === "SHARE_VIA")?.url || "";

    // Extract activity ID for constructing URL
    const activityUrn = comment.updateMetadata?.urn || "";
    const activityId = activityUrn.split(":").pop() || "";
    const url = activityId ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}` : postUrl;

    // Get the raw timestamp for filtering
    const timestamp = comment.highlightedComments?.[0]?.createdAt || comment.createdAt || null;

    return {
      urn,
      text: text.substring(0, 200) + (text.length > 200 ? "..." : ""), // Preview
      fullText: text,
      date: dateText,
      timestamp, // Raw timestamp for filtering
      impressions,
      likes,
      url,
      isOwnPost // Flag for filtering out comments on own posts
    };
  });

  // Filter to last 7 calendar days only (using local midnight boundaries)
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const msPerDay = 86400000;

  const recentComments = parsedComments.filter(c => {
    if (!c.timestamp) return false; // Skip comments without timestamp

    // Calculate days ago based on local midnight boundaries
    const commentDate = new Date(c.timestamp);
    const commentMidnight = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate(), 0, 0, 0, 0).getTime();
    const daysAgo = Math.floor((todayMidnight - commentMidnight) / msPerDay);

    if (daysAgo < 0 || daysAgo >= 7) return false; // Outside 7-day window (0-6 days ago)
    if (c.isOwnPost) return false; // Exclude comments on own posts
    return true;
  });

  return recentComments;
};

// ========== CREATOR COMMENTS SCRAPING ==========
// Helper to extract the best avatar from TopCard profile response
function extractAvatar(profile) {
  // Tier 1: profilePicture.displayImageReference.vectorImage (largest artifact)
  let vi = profile?.profilePicture?.displayImageReference?.vectorImage;
  if (vi?.rootUrl && vi?.artifacts?.length) {
    const largest = vi.artifacts.reduce((a, b) =>
      (b.width || 0) > (a.width || 0) ? b : a);
    return vi.rootUrl + largest.fileIdentifyingUrlPathSegment;
  }

  // Tier 1b: profilePicture["com.linkedin.common.VectorImage"]
  vi = profile?.profilePicture?.["com.linkedin.common.VectorImage"];
  if (vi?.rootUrl && vi?.artifacts?.[0]) {
    return vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
  }

  // Tier 1c: miniProfile fallback
  vi = profile?.miniProfile?.picture?.["com.linkedin.common.VectorImage"];
  if (vi?.rootUrl && vi?.artifacts?.[0]) {
    return vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
  }

  // Tier 1d: direct concat
  if (profile?.pictureRootUrl && profile?.pictureArtifact) {
    return profile.pictureRootUrl + profile.pictureArtifact;
  }

  return '';
}

// Extract avatar URL from LinkedIn Voyager TopCard profile response
// 4-tier fallback per Voyager API docs
function extractAvatar(profile) {
  try {
    // Path 1: profile.profilePicture.displayImageReference.vectorImage
    const vecImg = profile?.profilePicture?.displayImageReference?.vectorImage;
    if (vecImg && vecImg.rootUrl && vecImg.artifacts && vecImg.artifacts.length > 0) {
      const largest = vecImg.artifacts[vecImg.artifacts.length - 1];
      return vecImg.rootUrl + largest.fileIdentifyingUrlPathSegment;
    }

    // Path 2: profile.profilePicture["com.linkedin.common.VectorImage"]
    const vecImg2 = profile?.profilePicture?.['com.linkedin.common.VectorImage'];
    if (vecImg2 && vecImg2.rootUrl && vecImg2.artifacts && vecImg2.artifacts.length > 0) {
      return vecImg2.rootUrl + vecImg2.artifacts[0].fileIdentifyingUrlPathSegment;
    }

    // Path 3: profile.miniProfile.picture["com.linkedin.common.VectorImage"]
    const mini = profile?.miniProfile?.picture?.['com.linkedin.common.VectorImage'];
    if (mini && mini.rootUrl && mini.artifacts && mini.artifacts.length > 0) {
      return mini.rootUrl + mini.artifacts[0].fileIdentifyingUrlPathSegment;
    }

    // Path 4: profile.pictureRootUrl + profile.pictureArtifact (direct concat)
    if (profile?.pictureRootUrl && profile?.pictureArtifact) {
      return profile.pictureRootUrl + profile.pictureArtifact;
    }
  } catch (e) {
  }
  return '';
}

// Scrape creator TopCard and recent 50 comments
async function fetchCreatorComments(profileUrl) {
  const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (!match) throw new Error('Invalid LinkedIn profile URL');
  const username = match[1];

  // Step A: Resolve profile via TopCard-85
  const profileApiUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-85`;
  const profileData = await fetchLinkedIn(profileApiUrl);
  const profile = profileData?.data?.elements?.[0] || profileData?.elements?.[0];
  if (!profile) throw new Error('Profile not found or you are logged out');

  const profileUrn = profile.entityUrn;

  // --- Extract name and avatar from included array ---
  const included = profileData?.data?.included || profileData?.included || [];
  let name = username;
  let avatar = '';

  // Search included entities for profile data (firstName/lastName) and picture
  for (const item of included) {
    // Name: look for an entity with firstName/lastName
    if (item.firstName && item.lastName && !name.includes(' ')) {
      name = (item.firstName + ' ' + item.lastName).trim();
    }
    // Avatar: look for VectorImage with rootUrl + artifacts
    if (!avatar && item.rootUrl && item.artifacts && item.artifacts.length > 0) {
      const largest = item.artifacts[item.artifacts.length - 1];
      if (largest.fileIdentifyingUrlPathSegment) {
        avatar = item.rootUrl + largest.fileIdentifyingUrlPathSegment;
      }
    }
    // Avatar: profilePicture nested inside an included profile entity
    if (!avatar && item.profilePicture) {
      avatar = extractAvatar(item);
    }
    // Avatar: picture field (miniProfile style)
    if (!avatar && item.picture) {
      const vec = item.picture['com.linkedin.common.VectorImage'];
      if (vec && vec.rootUrl && vec.artifacts && vec.artifacts.length > 0) {
        avatar = vec.rootUrl + vec.artifacts[0].fileIdentifyingUrlPathSegment;
      }
    }
  }

  // Fallback name from profile top-level fields
  if (name === username && profile.firstName) {
    name = (profile.firstName + ' ' + (profile.lastName || '')).trim();
  }
  // Fallback avatar from profile top-level
  if (!avatar) {
    avatar = extractAvatar(profile);
  }


  // Send progress event to options page so it can show the avatar and name immediately
  try {
    chrome.runtime.sendMessage({
      action: "CREATOR_FETCH_PROGRESS",
      profileUrl: profileUrl,
      name: name,
      avatar: avatar
    });
  } catch (e) { }

  // Step B: Fetch comments via GraphQL WITH paginationToken (same approach as fetchAllUserComments in analytics)
  // The REST API profileUpdatesV2 returns POSTS not comments — GraphQL is the correct endpoint
  const COMMENTS_QID = 'voyagerFeedDashProfileUpdates.8f05a4e5ad12d9cb2b56eaa22afbcab9';
  const BATCH_SIZE = 50;
  const MAX_BATCHES = 10; // Safety limit: max 500 raw elements
  const TARGET_COMMENTS = 100; // Stop once we have enough quality comments

  let allElements = [];
  let start = 0;
  let batchNum = 0;
  let hasMore = true;
  let paginationToken = null;

  while (hasMore && batchNum < MAX_BATCHES) {
    batchNum++;

    // Delay between batches (300-800ms) to avoid rate limiting
    if (batchNum > 1) {
      const delay = 300 + Math.floor(Math.random() * 500);
      await new Promise(r => setTimeout(r, delay));
    }

    // Build GraphQL variables — include paginationToken when available (critical for getting more results)
    const variables = {
      count: BATCH_SIZE,
      start: start,
      profileUrn: profileUrn
    };
    if (paginationToken) {
      variables.paginationToken = paginationToken;
    }

    const result = await fetchLinkedInGraphQL(COMMENTS_QID, variables);

    if (!result.success) {
      if (batchNum === 1) throw new Error(`GraphQL Fetch Error: ${result.error}`);
      break;
    }

    // Extract elements from GraphQL response (nested data structure)
    let elements = result.data?.elements;
    let root = null;

    if (!elements && result.data?.data) {
      root = result.data.data.voyagerFeedDashProfileUpdates
        || result.data.data.feedDashProfileUpdatesByMemberComments;
      if (root && root.elements) {
        elements = root.elements;
      }
    }

    if (!elements) {
      if (batchNum === 1) throw new Error('Unexpected API response structure');
      break;
    }


    if (elements.length === 0) {
      hasMore = false;
      break;
    }

    // Deduplicate by URN before adding
    const seenUrns = new Set(allElements.map(e => e.urn || e.entityUrn || e.dashEntityUrn));
    let newCount = 0;
    for (const el of elements) {
      const id = el.urn || el.entityUrn || el.dashEntityUrn;
      if (id && seenUrns.has(id)) continue;
      if (id) seenUrns.add(id);
      allElements.push(el);
      newCount++;
    }

    if (newCount === 0) {
      hasMore = false;
      break;
    }

    // Extract paginationToken for next request (critical for GraphQL pagination)
    const newToken = root?.paging?.metadata?.paginationToken
      || root?.metadata?.paginationToken
      || result.data?.paging?.metadata?.paginationToken
      || result.data?.metadata?.paginationToken
      || null;


    if (newToken) {
      paginationToken = newToken;
      start += BATCH_SIZE;
    } else {
      hasMore = false;
    }

    // Count valid comments so far
    let tempCount = 0;
    for (const el of allElements) {
      const postAuthorUrn = el.actor?.backendUrn;
      const commenterUrn = el.highlightedComments?.[0]?.commenter?.urn;
      if (postAuthorUrn && commenterUrn && postAuthorUrn === commenterUrn) continue;
      const hc = el.highlightedComments?.[0];
      const commentText = hc?.commentary?.text || '';
      if (commentText && typeof commentText === 'string' && commentText.trim().length > 0) tempCount++;
    }

    if (tempCount >= TARGET_COMMENTS) {
      hasMore = false;
    }
  }



  // Tier 2 fallback: extract name + avatar from actor in elements
  if (name === username || !avatar) {
    for (const el of allElements) {
      // In comment activity, actor is the POST author (not the commenter)
      // For self-replies, actor === commenter, so we can use actor for name/avatar
      const postAuthorUrn = el.actor?.backendUrn;
      const commenterUrn = el.highlightedComments?.[0]?.commenter?.urn;
      if (postAuthorUrn && commenterUrn && postAuthorUrn === commenterUrn) {
        if (name === username) {
          const actorName = el.actor?.title?.text || el.actor?.name?.text || '';
          if (actorName && actorName.includes(' ')) {
            name = actorName;
          }
        }
        if (!avatar) {
          const actorImg = el.actor?.image?.attributes?.[0]?.miniProfile?.picture?.['com.linkedin.common.VectorImage']
            || el.actor?.image?.['com.linkedin.common.VectorImage']
            || el.actor?.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture?.vectorImage;
          if (actorImg && actorImg.rootUrl && actorImg.artifacts && actorImg.artifacts.length > 0) {
            avatar = actorImg.rootUrl + actorImg.artifacts[0].fileIdentifyingUrlPathSegment;
          }
        }
        if (name !== username && avatar) break;
      }
    }
  }

  // DEBUG: Log first element structure
  if (allElements.length > 0) {
    const firstEl = allElements[0];
    const hc = firstEl.highlightedComments?.[0];
    if (hc) {
    } else {
    }
  }

  // Step C: Extract comment texts from highlightedComments, skip self-replies, deduplicate
  // Pre-filter: skip short/generic/personal comments during scraping itself
  const isQualityComment = (text) => {
    // Strip emojis for word counting
    const stripped = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

    // Must have at least 10 real words (substantive comment)
    const words = stripped.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 10) return false;

    // Skip ALL CAPS comments (shouting without substance)
    if (stripped === stripped.toUpperCase() && stripped.length > 10) return false;

    // Skip comments that start by tagging someone (e.g. "Pooja Marwah - I'll take you to BBQ")
    if (/^[A-Z][a-z]+\s+[A-Z].*?\s*[-\u2013\u2014]\s*/u.test(stripped)) return false;

    // Skip generic patterns (case-insensitive)
    const lower = text.toLowerCase().trim();
    const genericPatterns = [
      /^(great|nice|good|awesome|amazing|wonderful|fantastic|brilliant|excellent|perfect|beautiful|incredible)\s*(post|one|work|stuff|job|share|point|read|content|article|insight|take|tip)?[.!]*$/i,
      /^(love|loved|loving)\s*(this|it|that|the)[.!]*$/i,
      /^(so\s+true|agree|agreed|exactly|facts|truth|this|amen|boom|yes|yep|nailed it|well said|spot on|on point|preach)[.!]*$/i,
      /^(thanks|thank you|thx|ty|cheers|grateful|appreciated)[.!]*$/i,
      /^(congrats|congratulations|proud of you|happy for you|well done|bravo|kudos)[.!]*$/i,
      /^(haha|lol|lmao|omg|wow|damn|whoa|yay|woah)[.!]*$/i,
      /^(miss you|see you|my bestie|love you|you rock|you.re the best|legend)[.!]*$/i,
      /^(following|subscribed|saved|bookmarked|noted|tagging|sharing)[.!]*$/i,
      /^(can you|please|dm me|check my|review my|look at my)/i,
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(lower)) return false;
    }

    return true;
  };

  let rawComments = [];
  const seenTexts = new Set();
  for (let el of allElements) {
    const postAuthorUrn = el.actor?.backendUrn;
    const commenterUrn = el.highlightedComments?.[0]?.commenter?.urn;

    // Skip self-replies (where the creator commented on their own post)
    if (postAuthorUrn && commenterUrn && postAuthorUrn === commenterUrn) continue;

    // Extract the creator's COMMENT text from highlightedComments
    const hc = el.highlightedComments?.[0];
    const text = hc?.commentary?.text || '';

    if (text && typeof text === 'string') {
      const trimmed = text.trim();
      if (trimmed.length > 0 && !seenTexts.has(trimmed) && isQualityComment(trimmed)) {
        seenTexts.add(trimmed);
        rawComments.push(trimmed);
      }
    }
  }

  if (rawComments.length === 0) throw new Error('No comments found for this creator on other peoples posts');


  return {
    id: 'creator_' + Date.now(),
    profile_url: profileUrl,
    profile_urn: profileUrn,
    name: name,
    avatar: avatar,
    raw_comments: rawComments,
    comments: [],
    fetched_at: new Date().toISOString()
  };
}

// ========== RATE LIMITING ==========
const MIN_FETCH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours minimum between fetches

const checkRateLimit = async () => {
  const { analytics_last_fetch } = await chrome.storage.local.get("analytics_last_fetch");
  if (!analytics_last_fetch) return { allowed: true };

  const elapsed = Date.now() - analytics_last_fetch;
  const remaining = MIN_FETCH_INTERVAL_MS - elapsed;

  if (remaining > 0) {
    return {
      allowed: false,
      retryAfterMs: remaining,
      retryAfterMins: Math.ceil(remaining / 60000)
    };
  }
  return { allowed: true };
};

const updateLastFetchTime = async () => {
  await chrome.storage.local.set({ analytics_last_fetch: Date.now() });
};

// Helper to extract profile views from wvmpCards response
const extractProfileViews = (data) => {
  try {
    return data?.elements?.[0]?.value?.["com.linkedin.voyager.identity.me.wvmpOverview.WvmpViewersCard"]
      ?.insightCards?.[0]?.value?.["com.linkedin.voyager.identity.me.wvmpOverview.WvmpSummaryInsightCard"]
      ?.numViews || 0;
  } catch { return 0; }
};

// ========== SESSION SAFETY ==========

// 1. CSRF Token Refresh - capture fresh token from LinkedIn requests
const initCSRFTokenRefresh = () => {
  chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    const csrfHeader = details.requestHeaders?.find(h => h.name === 'csrf-token');
    if (csrfHeader?.value) {
      chrome.storage.local.get(['linkedin_csrf_token'], (result) => {
        if (result.linkedin_csrf_token !== csrfHeader.value) {
          chrome.storage.local.set({ linkedin_csrf_token: csrfHeader.value });
        }
      });
    }
  }, { urls: ["https://www.linkedin.com/*"], types: ["xmlhttprequest"] },
    ["requestHeaders"]);
};

// 2. Cookie Change Detection - monitor li_at and JSESSIONID
const initCookieChangeDetection = () => {
  chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
    if (!cookie.domain.includes("linkedin.com")) return;
    if (!["li_at", "JSESSIONID"].includes(cookie.name)) return;


    if (removed && cookie.name === "li_at") {
      // User logged out - clear stored credentials
      clearStoredCredentials();
    }
  });
};

// 3. Clear credentials on logout
const clearStoredCredentials = async () => {
  await chrome.storage.local.remove([
    'linkedin_li_at',
    'linkedin_csrf_token',
    'analytics_last_fetch',
    'linkedin_cookies_updated_at'
  ]);
};

// Initialize session safety on extension load
initCSRFTokenRefresh();
initCookieChangeDetection();

// ========== END Cookie Extraction Helper ==========

chrome.runtime.onInstalled.addListener(function (details) {
  if (["install", "update"].includes(details.reason)) {
    loadScripts();
  }
  // Reset onboarding tour on install/update so the tour triggers
  if (details.reason === "install" || details.reason === "update") {
    chrome.storage.local.set({ superlio_onboarding_done: false, superlio_onboarding_phase2: false });
  }
  chrome.tabs.create({
    url: "https://app.superlio.ai/",
  }),
    (DreamAI.deviceToken = DreamAI.getRandomToken()),
    DreamAI.storage.set(DreamAI.defaultSettings, function (e) { });
}),
  chrome.runtime.onMessage.addListener(function (e, a, o) {
    return (
      "API" == e.action
        ? DreamAI.API.callendpoint(e.endpoint, e.data, function (e) {
          o(e);
        })
        : "getSettings" == e.action
          ? DreamAI.storage.get(e.keys, function (e) {
            o(e);
          })
          : "setSettings" == e.action
            ? DreamAI.storage.set(e.args, function (e) {
              o(e);
            })
            : "options" == e.action
              ? DreamAI.storage.getAll(function (e) {
                (e.api_server = DreamAI.API.base), o(e);
              })
              : "reset" == e.action
                ? DreamAI.storage.reset(function () {
                  o();
                })
                : "chatgpt" == e.action
                  ? DreamAI.chatGPT.getAccessTocken(function (a) {
                    let i = {
                      loging_required: !1,
                    };
                    if (a.accessToken) {
                      let c = {
                        accessToken: a.accessToken,
                        prompt: e.data.prompt,
                        content: e.data.content,
                      };
                      DreamAI.chatGPT.getComment(c, function (a) {
                        (t = a.lastIndexOf('"parts": ["')),
                          (n = a.indexOf('"]}', t)),
                          (h = (h = (h = a.slice(t + 11, n).replace(/\\n/g, ""))
                            .replace(/\\u00dc/g, "\xc3œ")
                            .replace(/\\u00f6/g, "\xc3\xb6")
                            .replace(/\\u00d6/g, "\xc3–")
                            .replace(/\\u00fc/g, "\xc3\xbc")
                            .replace(/\\u00e4/g, "\xc3\xa4")
                            .replace(/\\u00df/g, "\xc3Ÿ")
                            .replace(/\\u00e1/g, "\xc3\xa1")
                            .replace(/\\u00e9/g, "\xc3\xa9")
                            .replace(/\\u00f3/g, "\xc3\xb3")
                            .replace(/\\u00fa/g, "\xc3\xba")
                            .replace(/\\u00e3/g, "\xc3\xa3")
                            .replace(/\\u00ed/g, "\xc3\xad")
                            .replace(/\\u00ea/g, "\xc3\xaa")
                            .replace(/\\u00e2/g, "\xc3\xa2")
                            .replace(/\\u00f4/g, "\xc3\xb4")
                            .replace(/\\u00e7/g, "\xc3\xa7")
                            .replace(/\\u00e0/g, "\xc3 ")
                            .replace(/\\u00f2/g, "\xc3\xb2")).split("ud")[0]),
                          (i.comments = h),
                          (i.urn = e.data.urn),
                          o(i);
                      });
                    } else (i.loging_required = !0), o(i);
                  })
                  : "optionpage" == e.action &&
                  (chrome.runtime.openOptionsPage
                    ? chrome.runtime.openOptionsPage()
                    : window.open(chrome.runtime.getURL("options.html"))),
      !0
    );
  }),
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ========== FETCH CREATOR COMMENTS ACTION ==========
    // Internal listener for options page
    if (message.action === "FETCH_CREATOR_COMMENTS") {
      (async () => {
        try {
          const result = await fetchCreatorComments(message.profileUrl);
          sendResponse(result);
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;
    }

    if (message.type === "getCookieEmail") {
      (async () => {
        try {
          const userEmail = await LinkedInPostManager.getUserDetails();
          if (userEmail !== message.email) {
            throw new Error("Account email does not match. Please use the correct LinkedIn account.");
          }

          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true;
    }
  });
chrome.runtime.onMessageExternal.addListener((e, a, o) => {
  if (e.action === "ping") {
    o({ status: "alive" });
    return true;
  }

  // ========== FETCH CREATOR COMMENTS ACTION ==========
  // Used by Extension Options page to scrape creator comment styles
  if (e.action === "FETCH_CREATOR_COMMENTS") {
    (async () => {
      try {
        const result = await fetchCreatorComments(e.profileUrl);
        o(result);
      } catch (err) {
        o({ error: err.message });
      }
    })();
    return true;
  }

  // ========== VERIFY LINKEDIN ACCOUNT ACTION ==========
  // Used by dashboard to verify the logged-in LinkedIn account matches user's Superlio account
  // Uses /me Voyager API (reliable) instead of GraphQL contact info (unreliable queryId)
  if (e.type === "getCookieEmail" || e.action === "VERIFY_LINKEDIN_ACCOUNT") {
    (async () => {
      try {
        // Use /me API to get publicIdentifier - much more reliable than getUserDetails GraphQL
        const meResult = await fetchLinkedIn("https://www.linkedin.com/voyager/api/me");
        if (!meResult.success) {
          o({ success: false, error: "Could not verify LinkedIn account. Please ensure you're logged in to LinkedIn." });
          return;
        }

        const linkedInUsername = meResult.data.miniProfile?.publicIdentifier || meResult.data.publicIdentifier;

        // If we got a valid LinkedIn session, consider it verified
        // The actual identity check happens on the dashboard side with the returned profile
        if (linkedInUsername) {
          o({ success: true, linkedInUsername: linkedInUsername });
        } else {
          o({ success: false, error: "Could not verify LinkedIn account. Please refresh the page and try again." });
        }
      } catch (error) {
        o({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ========== FETCH ANALYTICS ACTION ==========
  // Used by dashboard to get current user's LinkedIn data via Voyager API
  if (e.action === "FETCH_ANALYTICS") {
    (async () => {
      try {
        // Check rate limit (unless forceRefresh is true)
        if (!e.forceRefresh) {
          const rateLimit = await checkRateLimit();
          if (!rateLimit.allowed) {
            o({
              success: false,
              error: `Rate limited. Please wait ${rateLimit.retryAfterMins} minutes.`,
              rateLimited: true,
              retryAfterMs: rateLimit.retryAfterMs
            });
            return;
          }
        }

        // Use existing fetchLinkedIn helper to call /voyager/api/me
        const result = await fetchLinkedIn("https://www.linkedin.com/voyager/api/me");

        if (!result.success) {
          o({ success: false, error: result.error });
          return;
        }

        // Extract required fields from response
        const data = result.data;
        const userData = {
          dashEntityUrn: data.dashEntityUrn || null,
          username: data.miniProfile?.vanityName || data.vanityName || null,
          publicIdentifier: data.miniProfile?.publicIdentifier || data.publicIdentifier || null,
          rawMiniProfile: data.miniProfile || null
        };

        await updateLastFetchTime();
        o({ success: true, data: userData });

      } catch (error) {
        o({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ========== FETCH PROFILE METRICS ACTION ==========
  // Used by dashboard to get follower count, connection count, and profile views
  if (e.action === "FETCH_PROFILE_METRICS") {
    (async () => {
      try {
        // Check rate limit (unless forceRefresh is true)
        if (!e.forceRefresh) {
          const rateLimit = await checkRateLimit();
          if (!rateLimit.allowed) {
            o({ success: false, error: `Rate limited`, rateLimited: true, retryAfterMs: rateLimit.retryAfterMs });
            return;
          }
        }

        // 1. First get username from /me endpoint
        const meResult = await fetchLinkedIn("https://www.linkedin.com/voyager/api/me");
        if (!meResult.success) {
          o({ success: false, error: meResult.error });
          return;
        }
        const username = meResult.data.miniProfile?.publicIdentifier || meResult.data.publicIdentifier;

        // 2. Fetch profile details (followers + connections)
        const profileUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-85`;
        const profileResult = await fetchLinkedIn(profileUrl);

        // 3. Fetch profile views
        const viewsResult = await fetchLinkedIn("https://www.linkedin.com/voyager/api/identity/wvmpCards");

        // 4. Fetch posts to get impressions
        // Get the profile URN - need fsd_profile format for profileUpdatesV2
        let profileUrn = meResult.data.miniProfile?.dashEntityUrn || meResult.data.dashEntityUrn;

        // If URN is in wrong format, try to construct from member ID
        if (!profileUrn || !profileUrn.includes('fsd_profile')) {
          // Try getting the member entityUrn and converting
          const memberUrn = meResult.data.miniProfile?.entityUrn || meResult.data.entityUrn;
          if (memberUrn) {
            // Convert urn:li:member:XXX to urn:li:fsd_profile:XXX
            const memberId = memberUrn.split(':').pop();
            profileUrn = `urn:li:fsd_profile:${memberId}`;
          }
        }


        // Build posts URL with proper encoding - moduleKey colon must be encoded
        const postsUrl = `https://www.linkedin.com/voyager/api/identity/profileUpdatesV2?count=50&includeLongTermHistory=true&moduleKey=member-shares%3Aphone&numComments=0&numLikes=0&profileUrn=${encodeURIComponent(profileUrn)}&q=memberShareFeed&start=0`;

        const postsResult = await fetchLinkedIn(postsUrl);

        // Calculate total impressions from posts in LAST 7 DAYS only
        let totalImpressions = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let postCount = 0;

        // Calculate 7 days ago timestamp
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        if (postsResult.success && postsResult.data?.elements) {
          postsResult.data.elements.forEach(post => {
            // Get post creation time - try to parse from accessibilityText like "3d" or "1w"
            let includePost = true; // Default: include all posts

            const timeText = post?.actor?.subDescription?.text || '';
            // Parse time like "3d", "1w", "2h", "5mo"
            const match = timeText.match(/(\d+)\s*(h|d|w|mo|y)/i);
            if (match) {
              const num = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              // Only include if within 7 days
              if (unit === 'w' && num >= 1) includePost = false; // 1 week or more = exclude
              if (unit === 'mo' || unit === 'y') includePost = false; // months/years = exclude
              // 'd' (days) with num > 7 = exclude
              if (unit === 'd' && num > 7) includePost = false;
            }

            if (includePost) {
              const impressions = post?.socialDetail?.totalSocialActivityCounts?.numImpressions || 0;
              const likes = post?.socialDetail?.totalSocialActivityCounts?.numLikes || 0;
              const comments = post?.socialDetail?.totalSocialActivityCounts?.numComments || 0;
              totalImpressions += impressions;
              totalLikes += likes;
              totalComments += comments;
              postCount++;
            }
          });
        }

        // Extract metrics
        const metrics = {
          followerCount: profileResult.data?.elements?.[0]?.followingState?.followerCount || 0,
          connectionCount: profileResult.data?.elements?.[0]?.connections?.paging?.total || 0,
          profileViews: extractProfileViews(viewsResult.data),
          postImpressions: totalImpressions,
          totalLikes: totalLikes,
          totalComments: totalComments,
          postCount: postCount,
          username: username,
          // Debug info
          _debug: {
            profileUrn: profileUrn,
            postsApiSuccess: postsResult.success,
            postsApiError: postsResult.error || null,
            rawPostsCount: postsResult.data?.elements?.length || 0
          }
        };

        await updateLastFetchTime();
        o({ success: true, data: metrics });

      } catch (error) {
        o({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ========== FETCH ALL POSTS ACTION ==========
  // Used by dashboard to get all posts with format detection
  if (e.action === "FETCH_ALL_POSTS") {
    (async () => {
      try {
        // 1. Get profileUrn from /me endpoint
        const meResult = await fetchLinkedIn("https://www.linkedin.com/voyager/api/me");
        if (!meResult.success) {
          o({ success: false, error: meResult.error });
          return;
        }

        let profileUrn = meResult.data.miniProfile?.dashEntityUrn || meResult.data.dashEntityUrn;
        if (!profileUrn || !profileUrn.includes('fsd_profile')) {
          const memberUrn = meResult.data.miniProfile?.entityUrn || meResult.data.entityUrn;
          if (memberUrn) {
            const memberId = memberUrn.split(':').pop();
            profileUrn = `urn:li:fsd_profile:${memberId}`;
          }
        }

        // Extract profile info from /me response
        // Extract profile info from /me response
        const miniProfile = meResult.data.miniProfile || {};

        let avatarUrl = null;
        if (miniProfile.picture) {
          if (miniProfile.picture["com.linkedin.common.VectorImage"]?.rootUrl) {
            const vi = miniProfile.picture["com.linkedin.common.VectorImage"];
            if (vi.artifacts?.length > 0) {
              avatarUrl = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
            }
          } else if (miniProfile.picture.rootUrl && miniProfile.picture.artifacts?.length > 0) {
            avatarUrl = miniProfile.picture.rootUrl + miniProfile.picture.artifacts[0].fileIdentifyingUrlPathSegment;
          }
        }

        // Fetch follower count from profile endpoint
        const username = miniProfile.publicIdentifier || meResult.data.publicIdentifier;
        let followerCount = 0;

        let rawProfileData = null;
        /* debug: added rawProfileData declaration */

        if (username) {
          try {
            const profileUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-85`;

            const profileResult = await fetchLinkedIn(profileUrl);
            rawProfileData = profileResult.data; // Capture raw data

            // Try multiple paths for follower count
            const element = profileResult.data?.elements?.[0];
            followerCount = element?.followingState?.followerCount
              || element?.networkInfo?.followerCount
              || element?.followerCount
              || 0;
          } catch (err) {
          }
        }

        // --- NEW: Fetch Comments (Test Implementation) ---
        let cachedComments = [];
        let parsedComments = [];
        let commentsDebug = [];
        let commentsError = null; // 3.2: Track errors for graceful degradation
        try {
          const result = await fetchAllUserComments(profileUrn);
          cachedComments = result.comments || [];
          commentsDebug = result.debug || [];

          // Parse comments to extract structured data
          parsedComments = parseCommentsData(cachedComments, profileUrn);
        } catch (commentErr) {
          commentsError = commentErr.message; // Capture error for response
          commentsDebug.push(`Global Error: ${commentErr.message}`);
        }
        // -------------------------------------------------

        // Try to get current position title - approach 1: fetch with WebProfileCard decoration
        let positionTitle = '';
        let positionCompany = '';

        if (username) {
          try {
            // Try WebProfileCard decoration which may include position title
            const webCardUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebProfileCard-28`;

            const webCardResult = await fetchLinkedIn(webCardUrl);
            if (webCardResult.success && webCardResult.data?.elements?.[0]) {
              const element = webCardResult.data.elements[0];

              // Try to find position title in various paths
              const position = element.position || element.currentPosition || element.positions?.[0];
              if (position?.title) {
                positionTitle = position.title;
                positionCompany = position.companyName || position.company?.name || '';
              }

              // Also check profileTopPosition with more detail
              const topPos = element.profileTopPosition?.elements?.[0];
              if (topPos && !positionTitle) {
                positionTitle = topPos.title || topPos.positionName || '';
                positionCompany = topPos.company?.name || topPos.companyName || '';
              }
            }
          } catch (err) {
          }
        }

        // Approach 2: Try full profile positions endpoint
        if (!positionTitle && profileUrn) {
          try {
            const positionsUrl = `https://www.linkedin.com/voyager/api/identity/dash/profilePositionGroups?q=viewee&profileUrn=${encodeURIComponent(profileUrn)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup-54`;

            const positionsResult = await fetchLinkedIn(positionsUrl);
            if (positionsResult.success && positionsResult.data?.elements?.length > 0) {

              for (const group of positionsResult.data.elements) {
                const positions = group.profilePositionInPositionGroup?.elements ||
                  group.positions?.elements ||
                  group.profilePosition?.elements || [];
                if (positions.length > 0) {
                  const pos = positions[0];
                  positionTitle = pos.title || pos.positionName || pos.multiLocaleTitle?.en_US || '';
                  positionCompany = pos.companyName || pos.company?.name || group.company?.name || '';
                  if (positionTitle) {
                    break;
                  }
                }
              }
            }
          } catch (err) {
          }
        }

        // Approach 3: Get company from rawProfileData TopPosition (we know this works)
        if (!positionCompany) {
          const topPosition = rawProfileData?.elements?.[0]?.profileTopPosition?.elements?.[0];
          if (topPosition) {
            positionCompany = topPosition.company?.name || topPosition.companyName || '';
          }
        }

        // Build currentPosition object
        const currentPos = {
          title: positionTitle,
          company: positionCompany,
          combined: positionTitle && positionCompany
            ? `${positionTitle} - ${positionCompany}`
            : (positionTitle || positionCompany || '')
        };

        const profileInfo = {
          name: [miniProfile.firstName, miniProfile.lastName].filter(Boolean).join(' ') || 'Unknown',
          headline: miniProfile.occupation || '',
          handle: username ? `@${username}` : '',
          avatar: avatarUrl,
          followerCount: followerCount,
          urn: profileUrn, // Add profileUrn to profileInfo
          publicIdentifier: username, // Add publicIdentifier to profileInfo
          rawProfileData: rawProfileData, // Expose raw Voyager API data to frontend
          rawMeData: meResult.data, // Expose raw /me data to frontend
          currentPosition: currentPos || { title: '', company: '', combined: '' } // Actual job title from experience
        };

        // ========== FOLLOWER GROWTH TRACKING ==========
        // Store follower count for week-over-week growth calculation
        // Use username in storage key to make it user-specific
        let followerGrowth = null;
        try {
          const storageKey = `superlio_follower_history_${username || 'default'}`;
          const stored = await chrome.storage.local.get(storageKey);
          const history = stored[storageKey] || {};

          // Get current week number (ISO week)
          const now = new Date();
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          const currentWeek = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
          const currentYear = now.getFullYear();
          const currentWeekKey = `${currentYear}-W${currentWeek}`;
          const lastWeekKey = `${currentWeek > 1 ? currentYear : currentYear - 1}-W${currentWeek > 1 ? currentWeek - 1 : 52}`;


          // Calculate growth if we have last week's data
          if (history[lastWeekKey] && history[lastWeekKey].count > 0) {
            const prevCount = history[lastWeekKey].count;
            const growth = followerCount - prevCount;
            const growthPct = Math.round((growth / prevCount) * 100 * 10) / 10; // 1 decimal
            followerGrowth = {
              previousCount: prevCount,
              previousWeek: lastWeekKey,
              currentCount: followerCount,
              growth: growth,
              growthPercentage: growthPct
            };
          } else {
          }

          // Store current week's follower count
          history[currentWeekKey] = {
            count: followerCount,
            timestamp: now.toISOString()
          };

          // Clean up old data (keep only last 8 weeks)
          const keys = Object.keys(history).sort().slice(-8);
          const cleanedHistory = {};
          keys.forEach(k => cleanedHistory[k] = history[k]);

          await chrome.storage.local.set({ [storageKey]: cleanedHistory });

        } catch (err) {
        }

        // Add growth to profileInfo
        profileInfo.followerGrowth = followerGrowth;

        // 2. Fetch posts with count=100 (LinkedIn API max)
        const postsUrl = `https://www.linkedin.com/voyager/api/identity/profileUpdatesV2?count=100&includeLongTermHistory=true&moduleKey=member-shares%3Aphone&numComments=0&numLikes=0&profileUrn=${encodeURIComponent(profileUrn)}&q=memberShareFeed&start=0`;
        const postsResult = await fetchLinkedIn(postsUrl);

        if (!postsResult.success) {
          o({ success: false, error: postsResult.error });
          return;
        }

        // 3. Helper to detect post format
        const detectPostFormat = (post) => {
          // Check for reshared content FIRST (reposts of other people's content)
          // Try multiple possible locations for repost indicators
          const hasResharedUpdate = post?.resharedUpdate;
          const hasNestedUpdate = post?.content?.resharedUpdate;
          const headerText = post?.header?.text?.text || "";
          const isRepostHeader = headerText.toLowerCase().includes('repost');

          // Debug log for first few posts
          if (!detectPostFormat._logCount) detectPostFormat._logCount = 0;
          if (detectPostFormat._logCount < 5) {
            detectPostFormat._logCount++;
          }

          if (hasResharedUpdate || hasNestedUpdate || isRepostHeader) return "Repost";

          const content = post?.content;
          if (!content) {
            return "Text";
          }
          // Check for document/carousel
          if (content["com.linkedin.voyager.feed.render.DocumentComponent"]) return "Carousel";
          // Check for video
          if (content["com.linkedin.voyager.feed.render.LinkedInVideoComponent"]) return "Video";
          // Check for images
          if (content["com.linkedin.voyager.feed.render.ImageComponent"]) return "Image";
          // Check for article/link preview
          if (content["com.linkedin.voyager.feed.render.ArticleComponent"]) return "Article";
          // Default to text
          return "Text";
        };

        // Helper to check if post is within last 30 days
        const isWithin30Days = (dateText) => {
          if (!dateText) return true; // If no date, include by default
          const match = dateText.match(/(\d+)\s*(h|d|w|mo|y)/i);
          if (!match) return true;
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          // Include if: hours, days ≤30, weeks ≤4
          if (unit === 'h') return true;
          if (unit === 'd' && num <= 30) return true;
          if (unit === 'w' && num <= 4) return true;
          // Exclude months and years
          return false;
        };

        // Helper to extract timestamp from relative date string ("19h", "3d", "1w")
        // Uses local midnight boundaries for accurate day calculation
        const parseRelativeDate = (dateText) => {
          if (!dateText) return Date.now();
          const now = new Date();

          // Handle "Just now", "now", etc.
          if (/just now|now|edited/i.test(dateText)) {
            return now.getTime();
          }

          const match = dateText.match(/(\d+)\s*(m|h|d|w|mo|y)/i);
          if (!match) return now.getTime();
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();

          // For minutes and hours: use exact time subtraction (same day logic)
          if (unit === 'm') {
            return now.getTime() - (num * 60 * 1000);
          }
          if (unit === 'h') {
            return now.getTime() - (num * 60 * 60 * 1000);
          }

          // For days, weeks, months, years: use calendar-based calculation
          // Start from local midnight of today and go back by calendar days
          const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

          let targetDate = new Date(localMidnight);
          if (unit === 'd') {
            targetDate.setDate(targetDate.getDate() - num);
          } else if (unit === 'w') {
            targetDate.setDate(targetDate.getDate() - (num * 7));
          } else if (unit === 'mo') {
            targetDate.setMonth(targetDate.getMonth() - num);
          } else if (unit === 'y') {
            targetDate.setFullYear(targetDate.getFullYear() - num);
          }

          // Return midday of that date to avoid timezone edge cases
          targetDate.setHours(12, 0, 0, 0);
          return targetDate.getTime();
        };

        // Day names for grouping
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // 4. Extract structured data from each post
        const allPosts = (postsResult.data?.elements || []).map(post => {
          // Get post text (commentary)
          const text = post?.commentary?.text?.text || "";
          const textPreview = text.substring(0, 200) + (text.length > 200 ? "..." : "");

          // Get date from subDescription (e.g., "3d", "1w")
          const date = post?.actor?.subDescription?.text || "";

          // Get activity ID for URL
          const activityUrn = post?.updateMetadata?.urn || "";
          const activityId = activityUrn.split(":").pop() || "";
          const url = activityId ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}` : "";

          // Get engagement metrics
          const stats = post?.socialDetail?.totalSocialActivityCounts || {};

          // Extract timestamp and day/hour for time analysis (from relative date string)
          const timestamp = parseRelativeDate(date);
          const postDate = timestamp ? new Date(timestamp) : null;
          const dayOfWeek = postDate ? dayNames[postDate.getDay()] : null;
          const hour = postDate ? postDate.getHours() : null;

          // Get the post author's URN to check if it's the profile owner's content
          const authorUrn = post?.actor?.urn || post?.actor?.image?.attributes?.[0]?.miniProfile?.dashEntityUrn || "";

          return {
            id: activityUrn,
            text: textPreview,
            fullText: text,
            date: date,
            timestamp: timestamp,
            dayOfWeek: dayOfWeek,
            hour: hour,
            format: detectPostFormat(post),
            impressions: stats.numImpressions || 0,
            likes: stats.numLikes || 0,
            comments: stats.numComments || 0,
            shares: post?.socialDetail?.totalShares || 0,
            url: url,
            authorUrn: authorUrn
          };
        });

        // Step 1: Filter out reposts of OTHER people's content
        // Posts with format === "Repost" are reposts of others' content
        const ownContentOnly = allPosts.filter(p => p.format !== "Repost");

        // Step 2: Sort by IMPRESSIONS (highest first) to keep posts with most engagement data
        // When you self-repost, LinkedIn moves impressions to the repost activity
        // So we need to keep the version with the highest stats
        const sortedByImpressions = [...ownContentOnly].sort((a, b) => (b.impressions || 0) - (a.impressions || 0));

        // Step 3: Deduplicate by unique post ID to catch exact duplicates
        // Self-reposts are already filtered out in Step 1 (format === "Repost")
        // Here we just ensure no duplicate activity IDs slip through
        const seenKeys = new Set();
        const uniquePosts = sortedByImpressions.filter(p => {
          // Use unique activity ID as the key - this ensures posts with same text are counted separately
          const key = p.id || p.url;

          if (!key) {
            return true; // Keep posts with no identifiable key (rare edge case)
          }
          if (seenKeys.has(key)) {
            return false; // Skip duplicate
          }
          seenKeys.add(key);
          return true;
        });

        // Filter to last 30 days for engagement metrics
        const posts = uniquePosts.filter(p => isWithin30Days(p.date));

        // Calculate engagement metrics
        const totals = {
          impressions: posts.reduce((sum, p) => sum + p.impressions, 0),
          likes: posts.reduce((sum, p) => sum + p.likes, 0),
          comments: posts.reduce((sum, p) => sum + p.comments, 0),
          shares: posts.reduce((sum, p) => sum + p.shares, 0)
        };

        const postCount = posts.length || 1; // Avoid division by zero
        const averages = {
          impressions: parseFloat((totals.impressions / postCount).toFixed(1)),
          likes: parseFloat((totals.likes / postCount).toFixed(2)),
          comments: parseFloat((totals.comments / postCount).toFixed(2))
        };

        const totalEngagement = totals.likes + totals.comments + totals.shares;
        const engagementRate = totals.impressions > 0
          ? parseFloat(((totalEngagement / totals.impressions) * 100).toFixed(2))
          : 0;

        // Calculate time analysis
        const byDayOfWeek = {};
        const byHour = {};

        posts.forEach(p => {
          // Group by day of week
          if (p.dayOfWeek) {
            if (!byDayOfWeek[p.dayOfWeek]) {
              byDayOfWeek[p.dayOfWeek] = { posts: 0, impressions: 0, likes: 0, comments: 0 };
            }
            byDayOfWeek[p.dayOfWeek].posts++;
            byDayOfWeek[p.dayOfWeek].impressions += p.impressions;
            byDayOfWeek[p.dayOfWeek].likes += p.likes;
            byDayOfWeek[p.dayOfWeek].comments += p.comments;
          }

          // Group by hour
          if (p.hour !== null) {
            if (!byHour[p.hour]) {
              byHour[p.hour] = { posts: 0, impressions: 0, likes: 0 };
            }
            byHour[p.hour].posts++;
            byHour[p.hour].impressions += p.impressions;
            byHour[p.hour].likes += p.likes;
          }
        });

        // Calculate averages for each day/hour
        Object.keys(byDayOfWeek).forEach(day => {
          const d = byDayOfWeek[day];
          d.avgImpressions = d.posts > 0 ? Math.round(d.impressions / d.posts) : 0;
          d.avgLikes = d.posts > 0 ? parseFloat((d.likes / d.posts).toFixed(1)) : 0;
        });

        Object.keys(byHour).forEach(hour => {
          const h = byHour[hour];
          h.avgImpressions = h.posts > 0 ? Math.round(h.impressions / h.posts) : 0;
        });

        // Find best day and hour by avg impressions
        let bestDay = null, bestDayAvg = 0;
        Object.entries(byDayOfWeek).forEach(([day, data]) => {
          if (data.avgImpressions > bestDayAvg) {
            bestDayAvg = data.avgImpressions;
            bestDay = day;
          }
        });

        let bestHour = null, bestHourAvg = 0;
        Object.entries(byHour).forEach(([hour, data]) => {
          if (data.avgImpressions > bestHourAvg) {
            bestHourAvg = data.avgImpressions;
            bestHour = parseInt(hour);
          }
        });

        // Calculate format analysis with percentages
        const formatAnalysis = {};
        ['Image', 'Carousel', 'Video', 'Text', 'Article', 'Repost'].forEach(format => {
          const formatPosts = posts.filter(p => p.format === format);
          const count = formatPosts.length;
          const pct = posts.length > 0 ? parseFloat(((count / posts.length) * 100).toFixed(1)) : 0;
          const totalLikes = formatPosts.reduce((sum, p) => sum + p.likes, 0);
          const avgLikes = count > 0 ? parseFloat((totalLikes / count).toFixed(2)) : 0;
          const totalImpressions = formatPosts.reduce((sum, p) => sum + p.impressions, 0);
          const avgImpressions = count > 0 ? Math.round(totalImpressions / count) : 0;

          formatAnalysis[format] = { count, pct, avgLikes, avgImpressions };
        });

        // Find best format by avg impressions
        let bestFormat = null, bestFormatAvg = 0;
        Object.entries(formatAnalysis).forEach(([format, data]) => {
          if (data.count > 0 && data.avgImpressions > bestFormatAvg) {
            bestFormatAvg = data.avgImpressions;
            bestFormat = format;
          }
        });

        // Calculate growth metrics
        // This week = strictly less than 7 days (excludes "1w" and "7d")
        const isThisWeek = (dateStr) => {
          const match = dateStr?.match(/(\d+)\s*(m|h|d|w)/i);
          if (!match) return false;
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === 'm' || unit === 'h') return true;
          if (unit === 'd' && num < 7) return true; // Strictly less than 7 days
          // "1w" and "7d" are NOT this week
          return false;
        };

        // Last week = posts marked "7d" or "1w" (7-13 days ago)
        const isLastWeek = (dateStr) => {
          const match = dateStr?.match(/(\d+)\s*(m|h|d|w)/i);
          if (!match) return false;
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === 'd' && num >= 7 && num <= 13) return true;
          if (unit === 'w' && num === 1) return true; // "1w" = last week
          return false;
        };

        const postsThisWeek = posts.filter(p => isThisWeek(p.date)).length;
        const postsLastWeek = posts.filter(p => isLastWeek(p.date)).length;

        // Posts per week (based on 30 days of data / 4.3 weeks)
        const postsPerWeek = parseFloat((posts.length / 4.3).toFixed(1));

        // Week-over-week growth %
        const weekOverWeekGrowth = postsLastWeek > 0
          ? Math.round(((postsThisWeek - postsLastWeek) / postsLastWeek) * 100)
          : (postsThisWeek > 0 ? 100 : 0);

        // Build top 3 posts (last 7 days)
        const topPosts = [...posts]
          .filter(p => {
            const match = p.date?.match(/(\d+)\s*(m|h|d|w)/i);
            if (!match) return false;
            const num = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit === 'm' || unit === 'h') return true;
            if (unit === 'd' && num <= 7) return true;
            return false;
          })
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 3)
          .map((post, index) => ({
            rank: index + 1,
            text: post.text,
            impressions: post.impressions,
            likes: post.likes,
            comments: post.comments,
            format: post.format,
            date: post.date,
            url: post.url
          }));


        // Build complete analytics object (2.9)
        o({
          success: true,
          data: {
            // Profile
            profile: profileInfo,

            // Summary Stats
            summary: {
              totalPosts: posts.length,
              avgImpressions: averages.impressions,
              avgLikes: averages.likes,
              avgComments: averages.comments,
              postsPerWeek: postsPerWeek
            },

            // Cumulative Totals
            totals: totals,

            // Engagement
            engagement: {
              rate: engagementRate,
              averages: averages
            },

            // Growth Metrics
            growth: {
              postsThisWeek: postsThisWeek,
              postsLastWeek: postsLastWeek,
              weekOverWeekGrowth: weekOverWeekGrowth,
              postsPerWeek: postsPerWeek
            },

            // Time Analysis
            timeAnalysis: {
              byDayOfWeek: byDayOfWeek,
              byHour: byHour,
              bestDay: bestDay,
              bestDayAvgImpressions: bestDayAvg,
              bestHour: bestHour,
              bestHourAvgImpressions: bestHourAvg
            },

            // Format Breakdown
            formats: formatAnalysis,
            bestFormat: bestFormat,
            bestFormatAvgImpressions: bestFormatAvg,

            // Top 3 Posts (last 7 days)
            topPosts: topPosts,

            // Raw posts list
            posts: posts,
            totalFetched: posts.length,

            // 3.1: Consolidated Comments Analytics Object
            commentsAnalytics: {
              totalComments: (() => {
                // Count only comments from last 7 days (matching commentsPerDay logic)
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                const msPerDay = 86400000;
                return parsedComments.filter(c => {
                  if (!c.timestamp) return false;
                  const commentDate = new Date(c.timestamp);
                  const commentMidnight = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate(), 0, 0, 0, 0).getTime();
                  const daysAgo = Math.floor((todayMidnight - commentMidnight) / msPerDay);
                  return daysAgo >= 0 && daysAgo < 7;
                }).length;
              })(),
              totalImpressions: (() => {
                // Sum only impressions from last 7 days (matching commentsPerDay logic)
                const now = new Date();
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                const msPerDay = 86400000;
                return parsedComments.filter(c => {
                  if (!c.timestamp) return false;
                  const commentDate = new Date(c.timestamp);
                  const commentMidnight = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate(), 0, 0, 0, 0).getTime();
                  const daysAgo = Math.floor((todayMidnight - commentMidnight) / msPerDay);
                  return daysAgo >= 0 && daysAgo < 7;
                }).reduce((acc, curr) => acc + (curr.impressions || 0), 0);
              })(),
              commentsPerDay: (() => {
                const counts = [0, 0, 0, 0, 0, 0, 0]; // Index 0 = Today, 6 = 6 days ago
                const now = new Date();
                // Local midnight of today
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                const msPerDay = 86400000;

                parsedComments.forEach(c => {
                  if (c.timestamp) {
                    // Calculate days ago based on local midnight boundaries
                    const commentDate = new Date(c.timestamp);
                    const commentMidnight = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate(), 0, 0, 0, 0).getTime();
                    const daysAgo = Math.floor((todayMidnight - commentMidnight) / msPerDay);
                    if (daysAgo >= 0 && daysAgo < 7) counts[daysAgo]++;
                  }
                });
                return counts;
              })(),
              impressionsPerDay: (() => {
                const imps = [0, 0, 0, 0, 0, 0, 0]; // Index 0 = Today, 6 = 6 days ago
                const now = new Date();
                // Local midnight of today
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                const msPerDay = 86400000;

                parsedComments.forEach(c => {
                  if (c.timestamp) {
                    // Calculate days ago based on local midnight boundaries
                    const commentDate = new Date(c.timestamp);
                    const commentMidnight = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate(), 0, 0, 0, 0).getTime();
                    const daysAgo = Math.floor((todayMidnight - commentMidnight) / msPerDay);
                    if (daysAgo >= 0 && daysAgo < 7) imps[daysAgo] += (c.impressions || 0);
                  }
                });
                return imps;
              })(),
              comments: parsedComments, // Full list of parsed comments
              error: commentsError // 3.2: Null if no error, error message string if failed
            },
            // Debug fields (can be removed in production)
            commentsDebug: commentsDebug
          }
        });

      } catch (error) {
        o({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ========== SCRAPE CREATOR POSTS ACTION (VOYAGER API) ==========
  // Used by dashboard to fetch creator's LinkedIn posts for Creator Mode
  // Replaced DOM scraping with Voyager API for faster, more reliable fetching
  if (e.action === "SCRAPE_CREATOR_POSTS") {
    const profileUrl = e.profileUrl;
    const count = e.count || 20;

    (async () => {
      try {
        // 1. Check LinkedIn login
        const isLoggedIn = await LinkedInPostManager.checkLinkedInLogin();
        if (!isLoggedIn) {
          o({ success: false, error: "Not logged in to LinkedIn. Please sign in first." });
          return;
        }

        // 2. Extract username from URL
        const usernameMatch = profileUrl.match(/\/in\/([^/?#]+)/);
        if (!usernameMatch) {
          o({ success: false, error: "Invalid LinkedIn profile URL" });
          return;
        }
        const username = usernameMatch[1];

        // 3. Get creator's profile info & URN via Voyager API
        const profileApiUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-85`;
        const profileResult = await fetchLinkedIn(profileApiUrl);

        if (!profileResult.success) {
          o({ success: false, error: "Failed to fetch creator profile" });
          return;
        }

        const profileData = profileResult.data?.elements?.[0];
        if (!profileData) {
          o({ success: false, error: "Creator profile not found" });
          return;
        }

        // DEBUG: Log the entire profile response to find correct paths

        // Extract profileUrn (try multiple locations)
        let profileUrn = profileData?.entityUrn || profileData?.dashEntityUrn;
        if (!profileUrn) {
          // Build from member ID if direct URN not available
          const memberId = profileData?.memberIdentity || profileData?.publicIdentifier;
          if (memberId) {
            profileUrn = `urn:li:fsd_profile:${memberId}`;
          }
        }

        if (!profileUrn) {
          o({ success: false, error: "Could not determine profile URN" });
          return;
        }

        // Extract author info from profile - try multiple paths
        // Path 1: Direct firstName/lastName (TopCardSupplementary format)
        let firstName = profileData?.firstName || '';
        let lastName = profileData?.lastName || '';

        // Path 2: Try from miniProfile structure
        if (!firstName && profileData?.miniProfile) {
          firstName = profileData.miniProfile.firstName || '';
          lastName = profileData.miniProfile.lastName || '';
        }

        // Path 3: Try from profileTopCard
        if (!firstName && profileData?.profileTopCard) {
          firstName = profileData.profileTopCard.firstName || '';
          lastName = profileData.profileTopCard.lastName || '';
        }

        // DEBUG: Log what we found

        let authorName = `${firstName} ${lastName}`.trim() || username;
        let authorHeadline = profileData?.headline || profileData?.miniProfile?.occupation || '';

        // Get profile picture URL - try multiple paths
        let authorImage = null;

        // DEBUG: Log picture data paths

        // Path 1: profilePicture.displayImageReference.vectorImage (TopCardSupplementary format)
        const pictureData = profileData?.profilePicture?.displayImageReference?.vectorImage;
        if (pictureData?.rootUrl && pictureData?.artifacts?.length > 0) {
          const largestArtifact = pictureData.artifacts.reduce((prev, curr) =>
            (curr.width > (prev?.width || 0)) ? curr : prev
            , null);
          if (largestArtifact) {
            authorImage = pictureData.rootUrl + largestArtifact.fileIdentifyingUrlPathSegment;
          }
        }

        // Path 2: profilePicture with com.linkedin.common.VectorImage (miniProfile format)
        if (!authorImage) {
          const vi = profileData?.profilePicture?.['com.linkedin.common.VectorImage'];
          if (vi?.rootUrl && vi?.artifacts?.length > 0) {
            authorImage = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
          }
        }

        // Path 3: miniProfile.picture with VectorImage
        if (!authorImage && profileData?.miniProfile?.picture) {
          const mp = profileData.miniProfile.picture;
          const vi = mp?.['com.linkedin.common.VectorImage'];
          if (vi?.rootUrl && vi?.artifacts?.length > 0) {
            authorImage = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
          } else if (mp?.rootUrl && mp?.artifacts?.length > 0) {
            authorImage = mp.rootUrl + mp.artifacts[0].fileIdentifyingUrlPathSegment;
          }
        }

        // Path 4: Direct pictureRootUrl + pictureArtifact (some API versions)
        if (!authorImage && profileData?.pictureRootUrl && profileData?.pictureArtifact) {
          authorImage = profileData.pictureRootUrl + profileData.pictureArtifact;
        }



        // 4. Fetch creator's posts via Voyager API WITH PAGINATION
        // Keep fetching until we have at least 10 unique non-repost posts
        const MIN_POSTS_TARGET = 10;
        const BATCH_SIZE = 50;
        const MAX_BATCHES = 5; // Safety limit to prevent infinite loops

        let allRawElements = [];
        let start = 0;
        let batchCount = 0;
        let hasMorePosts = true;


        // Collect raw posts, filtering will happen after
        while (hasMorePosts && batchCount < MAX_BATCHES) {
          const postsUrl = `https://www.linkedin.com/voyager/api/identity/profileUpdatesV2?count=${BATCH_SIZE}&includeLongTermHistory=true&moduleKey=member-shares%3Aphone&numComments=0&numLikes=0&profileUrn=${encodeURIComponent(profileUrn)}&q=memberShareFeed&start=${start}`;

          const batchResult = await fetchLinkedIn(postsUrl);

          if (!batchResult.success) {
            if (batchCount === 0) {
              o({ success: false, error: "Failed to fetch creator posts" });
              return;
            }
            break;
          }

          const elements = batchResult.data?.elements || [];

          if (elements.length === 0) {
            hasMorePosts = false;
            break;
          }

          allRawElements = allRawElements.concat(elements);

          // Count unique non-repost posts so far
          const uniqueCount = allRawElements.filter(p => !p.resharedUpdate && !p?.header?.text?.text?.toLowerCase().includes('repost')).length;

          if (uniqueCount >= MIN_POSTS_TARGET || elements.length < BATCH_SIZE) {
            hasMorePosts = false;
          }

          start += BATCH_SIZE;
          batchCount++;
        }


        // Create postsResult-like object for compatibility
        const postsResult = { success: true, data: { elements: allRawElements } };

        if (!postsResult.success) {
          o({ success: false, error: "Failed to fetch creator posts" });
          return;
        }

        // 5. FALLBACK: Extract author info from first post's actor data
        // This is more reliable than the profile API since posts definitely have actor info
        const rawElements = postsResult.data?.elements || [];
        if (rawElements.length > 0) {
          // Debug: Log first post structure to understand actor format

          const firstPost = rawElements.find(p => !p.resharedUpdate) || rawElements[0];
          const actor = firstPost?.actor;

          if (actor) {
            // Extract name from actor.title.text or actor.name.text
            if (!firstName || firstName === '') {
              const actorName = actor?.title?.text || actor?.name?.text || '';
              if (actorName && actorName.includes(' ')) {
                const parts = actorName.split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
              }
            }

            // Extract headline from actor.description if missing
            if (!authorHeadline && actor?.description?.text) {
              authorHeadline = actor.description.text;
            }

            // Extract image from actor.image structure
            if (!authorImage) {
              const actorImage = actor?.image;

              // Path 1: actor.image.attributes[0].miniProfile.picture
              const miniProfile = actorImage?.attributes?.[0]?.miniProfile;
              if (miniProfile?.picture) {
                const mp = miniProfile.picture;
                const vi = mp?.['com.linkedin.common.VectorImage'];
                if (vi?.rootUrl && vi?.artifacts?.length > 0) {
                  authorImage = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
                }
              }

              // Path 2: actor.image.com.linkedin.common.VectorImage
              if (!authorImage) {
                const vi = actorImage?.['com.linkedin.common.VectorImage'];
                if (vi?.rootUrl && vi?.artifacts?.length > 0) {
                  authorImage = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
                }
              }

              // Path 3: Direct rootUrl in actor.image.attributes
              if (!authorImage && actorImage?.attributes?.[0]) {
                const attr = actorImage.attributes[0];
                if (attr?.detailData?.nonEntityProfilePicture?.vectorImage) {
                  const vi = attr.detailData.nonEntityProfilePicture.vectorImage;
                  if (vi?.rootUrl && vi?.artifacts?.length > 0) {
                    authorImage = vi.rootUrl + vi.artifacts[0].fileIdentifyingUrlPathSegment;
                  }
                }
              }
            }
          }
        }

        // Rebuild authorName after potential fallback extraction
        const finalAuthorName = `${firstName} ${lastName}`.trim() || username;

        // 6. Extract post texts (filter reposts, extract commentary)
        const posts = (postsResult.data?.elements || [])
          .filter(post => {
            // Skip reposts
            if (post.resharedUpdate) return false;
            const headerText = post?.header?.text?.text || '';
            if (headerText.toLowerCase().includes('repost')) return false;
            return true;
          })
          .map(post => {
            // Primary: commentary text
            const commentary = post?.commentary?.text?.text || '';
            if (commentary) return commentary;

            // Fallback: article title for shared links
            const articleTitle = post?.content?.['com.linkedin.voyager.feed.render.ArticleComponent']?.title?.text || '';
            return articleTitle;
          })
          .filter(text => text && text.length > 50) // Filter short/empty posts
          .slice(0, count);


        // 6. Convert profile image to Base64 if available
        if (authorImage && !authorImage.startsWith('data:')) {
          try {
            const response = await fetch(authorImage);
            const blob = await response.blob();
            authorImage = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          } catch (imgErr) {
            // Keep original URL as fallback
          }
        }

        // 7. Return response in same format as old DOM scraping
        o({
          success: true,
          posts,
          count: posts.length,
          authorName: finalAuthorName,
          authorImage,
          authorHeadline
        });

      } catch (error) {
        o({ success: false, error: error.message || "Failed to fetch creator posts" });
      }
    })();
    return true;
  }
  // ========== END SCRAPE CREATOR POSTS (VOYAGER API) ==========
}),

  chrome.action.onClicked.addListener(function (e) {
    chrome.tabs.sendMessage(
      e.id,
      {
        action: "md_icon_click",
      },
      function (e) { }
    );
  }),
  chrome.runtime.setUninstallURL(
    "https://www.superlio.ai/chromeunistall",
    function () { }
  );

var DreamAI = {
  defaultSettings: {
    deviceToken: !1,
    tones: {
      friendly: "\uD83D\uDE0A Friendly",
      funny: "\uD83E\uDD2D Funny",
      disagree: "\uD83E\uDD14 Disagree",
      congratulate: "\uD83D\uDC4F Congratulate",
      question: "❓ Question",
    },
  },
  chatGPT: {
    getAccessTocken: function (e) {
      fetch((url = "https://chat.openai.com/api/auth/session"), {
        method: "GET",
      })
        .then((e) => e.json())
        .then((a) => e(a));
    },
    getComment: function (e, a) {
      let o = this.rand_id(),
        i = this.rand_id();
      fetch("https://chat.openai.com/backend-api/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + e.accessToken,
        },
        body: JSON.stringify({
          action: "next",
          messages: [
            {
              id: o,
              role: "user",
              content: {
                content_type: "text",
                parts: [e.prompt + " " + e.content],
              },
            },
          ],
          model: "text-davinci-002-render-sha",
          parent_message_id: i,
        }),
      })
        .then((e) => e.text())
        .then((e) => a(e));
    },
    rand_id: function e() {
      var a = new Date().getTime();
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (e) {
          var o = (a + 16 * Math.random()) % 16 | 0;
          return (
            (a = Math.floor(a / 16)), ("x" == e ? o : (3 & o) | 8).toString(16)
          );
        }
      );
    },
  },
  testcall: function (e) {
    (url = "https://chat.openai.com/backend-api/conversation"),
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1UaEVOVUpHTkVNMVFURTRNMEZCTWpkQ05UZzVNRFUxUlRVd1FVSkRNRU13UmtGRVFrRXpSZyJ9.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJtYWlsbWVhdHN1ZGlwZGFzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7InVzZXJfaWQiOiJ1c2VyLVNTM2E3OVJUMzFxS0N0NlRuUERlczZhYyJ9LCJpc3MiOiJodHRwczovL2F1dGgwLm9wZW5haS5jb20vIiwic3ViIjoiYXV0aDB8NjNiN2FlZjVkNTA4NGIxM2Y3M2FmYzQ4IiwiYXVkIjpbImh0dHBzOi8vYXBpLm9wZW5haS5jb20vdjEiLCJodHRwczovL29wZW5haS5vcGVuYWkuYXV0aDBhcHAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTY5NjM5OTQwMSwiZXhwIjoxNjk3MjYzNDAxLCJhenAiOiJUZEpJY2JlMTZXb1RIdE45NW55eXdoNUU0eU9vNkl0RyIsInNjb3BlIjoib3BlbmlkIGVtYWlsIHByb2ZpbGUgbW9kZWwucmVhZCBtb2RlbC5yZXF1ZXN0IG9yZ2FuaXphdGlvbi5yZWFkIG9yZ2FuaXphdGlvbi53cml0ZSBvZmZsaW5lX2FjY2VzcyJ9.r-10kACEuHc0OTmrljpkXPE2OksrDYTTAhTbC4wBuohkuLiIBDQSG6xwHY8VHqv1qx4viwnGPU9BoX_6O-Ljdd2BdxpQRMSWnouw86iz9xpvT4MbNXkh1twGvRcn4ZMEuNQPOc1c_S5mbpL_PNvqDQMTtRpOnVPyVWrHYl-mgou9TH9gDw82i99dp1NbZqwF8bQ-sctXErcVd1k2xgZmJNCeZ0OKwhTINRhJ7kIpvi4UekbNixxX3pswI7aXTuYrxtT59subsBWLZNJd7J-5G4BZceIWlo01-r6ydOUYJs4H50IilMYESeuOH_TRdjwXmJxBla8AYKyLTiEfNPxNCA",
        },
        body: JSON.stringify({
          action: "next",
          messages: [
            {
              id: "aaa21483-9913-4cb0-860e-20ed92d2c7b7",
              role: "user",
              content: {
                content_type: "text",
                parts: ["Reply in 1 sentence"],
              },
            },
          ],
          model: "text-davinci-002-render-sha",
          parent_message_id: "a875f9be-2eb1-4b9e-a30a-158bd67698d3",
        }),
      })
        .then((e) => e.text())
        .then((a) => e(a));
  },
  API: {
    base: "https://app.superlio.ai/api/",
    callendpoint: function (e, a, o) {
      let i = this.base + e;
      this.post(i, a, o);
      var c = new Date(),
        r =
          c.getFullYear() +
          "-" +
          ("0" + (c.getMonth() + 1)).slice(-2) +
          "-" +
          ("0" + c.getDate()).slice(-2) +
          " " +
          ("0" + c.getHours()).slice(-2) +
          ":" +
          ("0" + c.getMinutes()).slice(-2) +
          ":" +
          ("0" + c.getSeconds()).slice(-2);
      DreamAI.storage.set({
        api: e,
        call_time: r,
      });
    },
    post: function (e, a, o) {
      let i = new FormData();
      for (var c in a) i.append(c, a[c]);
      fetch(e, {
        method: "POST",
        body: i,
      })
        .then((response) => {
          return response.text().then((text) => {
            try {
              return JSON.parse(text);
            } catch (err) {
              return { error: true, msg: "Server Error: Invalid response format.", raw: text };
            }
          });
        })
        .then((e) => o(e))
        .catch((err) => {
          o({ error: true, msg: "Network Error: " + err.message });
        });
    },
  },
  storage: {
    set: function (e, a) {
      chrome.storage.local.get("DreamAI", (o) => {
        let i = o.DreamAI;
        for (let c in (void 0 === i && (i = {}), e)) i[c] = e[c];
        chrome.storage.local.set(
          {
            DreamAI: i,
          },
          () => {
            a && a(e);
          }
        );
      });
    },
    get: function (e, a) {
      chrome.storage.local.get("DreamAI", (o) => {
        let i = o.DreamAI,
          c = {};
        for (let r in e)
          void 0 !== i[(key = e[r])] ? (c[key] = i[key]) : (c[key] = !1);
        a(c);
      });
    },
    getAll: function (e) {
      chrome.storage.local.get("DreamAI", (a) => {
        e(a.DreamAI);
      });
    },
    reset: function (e) {
      chrome.storage.local.set(
        {
          DreamAI: DreamAI.defaultSettings,
        },
        () => {
          e && e();
        }
      );
    },
  },
  getRandomToken: function () {
    let e = "",
      a = new Uint8Array(32);
    crypto.getRandomValues(a);
    for (let o = 0; o < a.length; ++o) e += a[o].toString(16);
    return e;
  },
};

function loadScripts() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      const url = tab.url || "";

      // Skip restricted or system pages
      if (
        tab.id &&
        url.startsWith("http") &&
        !url.includes("chrome.google.com/webstore") &&
        !url.includes("chromewebstore.google") &&
        !url.includes("chrome://") &&
        !url.startsWith("chrome://") &&
        !url.startsWith("chrome-extension://")
      ) {
        // Only inject if not already covered by content_scripts
        chrome.scripting
          .insertCSS({
            target: { tabId: tab.id },
            files: ["css/dream100.css"],
          })
          .catch(() => { });

        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: [
              "js/jquery.min.js",
              "js/arrive.js",
              "js/dream100.js",
            ],
          })
          .catch(() => { });
      }
    }
  });
}

const LinkedInPostManager = {
  queryId: "voyagerContentcreationDashShares.2e462fe06c2124f6ec35370ea350e18a",
  apiUrl:
    "https://www.linkedin.com/voyager/api/graphql?action=execute&queryId=",

  getCookie: async function (name, url = "https://www.linkedin.com") {
    return new Promise((resolve, reject) => {
      chrome.cookies.get({ url, name }, (cookie) => {
        if (cookie) {
          resolve(cookie.value.replace(/["']/g, ""));
        } else {
          reject(new Error("Not logged in to LinkedIn. Please sign in first."));
        }
      });
    });
  },

  checkLinkedInLogin: async function () {
    try {
      const cookies = await chrome.cookies.getAll({ domain: ".linkedin.com" });
      const hasSessionCookies = cookies.some(
        (cookie) =>
          ["JSESSIONID", "li_at", "bcookie"].includes(cookie.name) &&
          cookie.value &&
          cookie.value.length > 0
      );
      const liAtCookie = cookies.find((cookie) => cookie.name === "li_at");
      return hasSessionCookies && !!liAtCookie;
    } catch (error) {
      return false;
    }
  },

  handleMediaUpload: async function (media) {
    const payload = {
      mediaUploadType: media.type.startsWith("image")
        ? "IMAGE_SHARING"
        : "DOCUMENT_SHARING",
      fileSize: media.fileSize,
      filename: media.filename,
    };

    const JSESSIONID = await this.getCookie("JSESSIONID");
    if (!JSESSIONID)
      throw new Error("Not logged in to LinkedIn. Please sign in first.");

    try {
      const response = await fetch(
        "https://www.linkedin.com/voyager/api/voyagerVideoDashMediaUploadMetadata?action=upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "csrf-token": JSESSIONID,
            "x-restli-protocol-version": "2.0.0",
          },
          body: JSON.stringify(payload),
          credentials: "include",
        }
      );

      const data = await response.json();
      const mediaUrn = data?.value?.urn;
      const uploadUrl = data?.value?.singleUploadUrl;
      const recipes = data?.value?.recipes;

      if (media.base64 && uploadUrl) {
        await this.uploadImageToLinkedIn(uploadUrl, media.base64, media.type);
      }

      return { mediaUrn, recipes };
    } catch (error) {
      let errorMessage = String(error?.message);

      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      throw new Error(errorMessage)
    }
  },

  uploadImageToLinkedIn: async function (uploadUrl, base64String, mimeType) {
    const cleanedBase64 = base64String.replace(/^data:[^;]+;base64,/, "");
    const byteCharacters = atob(cleanedBase64);
    const byteArrays = [];

    const sliceSize = 1024 * 1024;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    try {
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
        },
        body: blob,
      });

      if (!response.ok) {
        const err = await response.text();
        // throw new Error(err);
        let errorMessage = String(err?.message);

        if (errorMessage.length > 200) {
          errorMessage = errorMessage.substring(0, 200) + "...";
        }
        throw new Error(errorMessage)
      }

    } catch (error) {
      let errorMessage = String(error?.message);

      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      throw new Error(errorMessage)
    }
  },

  // uploadImageToLinkedIn: async function (uploadUrl, base64String, mimeType) {
  //   const binary = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
  //   ;

  //   try {
  //     const response = await fetch(uploadUrl, {
  //       method: "PUT",
  //       headers: {
  //         "Content-Type": mimeType,
  //       },
  //       body: binary,
  //     });
  //     if (!response.ok) {
  //       const err = await response.text();
  //       throw new Error(err);
  //     }
  //     ;
  //   } catch (error) {
  //     ;
  //     throw error;
  //   }
  // },

  fetchLinkedInData: async function (
    postContent,
    timestamp,
    tabId,
    mediaUrn,
    recipes,
    media,
    title
  ) {
    try {
      const JSESSIONID = await this.getCookie("JSESSIONID");
      if (!JSESSIONID)
        throw new Error("Not logged in to LinkedIn. Please sign in first.");

      const url = `${this.apiUrl}${this.queryId}`;
      const headers = {
        "csrf-token": JSESSIONID,
        "x-restli-protocol-version": "2.0.0",
        accept: "application/json",
        "content-type": "application/json",
      };

      const postPayload = {
        allowedCommentersScope: "ALL",
        origin: "FEED",
        visibilityDataUnion: { visibilityType: "ANYONE" },
        commentary: { text: postContent, attributesV2: [] },
      };

      if (timestamp) {
        const scheduledAt = new Date(timestamp).getTime();
        if (isNaN(scheduledAt)) throw new Error("Invalid schedule time format.");
        postPayload.intendedShareLifeCycleState = "SCHEDULED";
        postPayload.scheduledAt = scheduledAt;
      } else {
        postPayload.intendedShareLifeCycleState = "PUBLISHED";
      }

      const mimeType = media?.type?.startsWith("image")
        ? "IMAGE"
        : "NATIVE_DOCUMENT";
      if (mediaUrn) {
        postPayload.media =
          mimeType === "IMAGE"
            ? {
              category: "IMAGE",
              mediaUrn,
              tapTargets: [],
              altText: "",
            }
            : {
              category: "NATIVE_DOCUMENT",
              mediaUrn,
              title,
              recipes,
            };
      }

      const payload = {
        variables: { post: postPayload },
        queryId: this.queryId,
        includeWebMetadata: true,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await response.json();
      const postUrn =
        data?.value?.data?.createContentcreationDashShares?.entity?.entityUrn;
      const inputString =
        data?.value?.data?.createContentcreationDashShares?.resourceKey;
      const shareUrn = inputString?.match(/urn:li:(?:share|ugcPost):\d+/)?.[0];

      if (data?.value?.errors?.length > 0) {
        let errorMessage = String(data.value.errors[0].message);

        if (errorMessage.length > 200) {
          errorMessage = errorMessage.substring(0, 200) + "...";
        }
        throw new Error(errorMessage);
      }
      if (!shareUrn)
        throw new Error("LinkedIn post failed: shareUrn was not returned.");

      chrome.storage.local.set({ shareUrn });

      if (postUrn) {
        const viewPostUrl = "https://www.linkedin.com/voyager/api/graphql";
        const viewQueryId =
          "voyagerContentcreationDashShares.1959784c19a2a8f8b843e7d60aff6314";
        const encodedVars = `(shareUrn:${encodeURIComponent(postUrn)})`;
        const finalUrl = `${viewPostUrl}?variables=${encodedVars}&queryId=${viewQueryId}`;

        try {
          const viewResponse = await fetch(finalUrl, {
            method: "GET",
            headers: {
              "csrf-token": JSESSIONID,
              "x-restli-protocol-version": "2.0.0",
              accept: "application/json",
            },
            credentials: "include",
          });

          const viewData = await viewResponse.json();
          // ;
        } catch (error) {
          if (tabId) chrome.tabs.remove(tabId);
        }
      }

      if (tabId) chrome.tabs.remove(tabId);
      return shareUrn;
    } catch (error) {
      let errorMessage = String(error?.message);

      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      throw new Error(errorMessage)
    }
  },

  deletePost: async function (shareUrn) {
    try {
      const JSESSIONID = await this.getCookie("JSESSIONID");

      if (!JSESSIONID) {
        throw new Error("Not logged in to LinkedIn. Please sign in first.");
      }
      const queryId =
        "voyagerContentcreationDashShares.b7155044c276d51764fc9981037204b3";
      const url = `${this.apiUrl}${queryId}`;

      const headers = {
        "csrf-token": JSESSIONID,
        "x-restli-protocol-version": "2.0.0",
        accept: "application/json",
        "content-type": "application/json",
      };

      const payload = {
        variables: {
          resourceKey: shareUrn,
          shareLifecycleState: "SCHEDULED",
        },
        queryId: queryId,
        includeWebMetadata: true,
      };
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await response.json();

      if (data?.value?.errors?.length > 0) {
        if (data.value.errors[0]?.extensions?.status == 404) {
          throw new Error("LinkedIn Post Not Found");
        }
        throw new Error("LinkedIn Delete Post Failed With Unknown Error.");
      }

      // ;
      return true;
    } catch (error) {
      let errorMessage = String(error?.message);

      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      throw new Error(errorMessage);
    }
  },
  getUserDetails: async function () {
    try {
      // Get LinkedIn JSESSIONID cookie
      const JSESSIONID = await this.getCookie("JSESSIONID");

      if (!JSESSIONID) {
        throw new Error("Not logged in to LinkedIn. Please sign in first.");
      }
      const queryId = 'voyagerIdentityDashProfileEditFormPages.5dcd30f6f18764e0683e9ee24189839f'
      const url = `https://www.linkedin.com/voyager/api/graphql?variables=(profileEditFormType:CONTACT_INFO)&queryId=${queryId}`;

      const headers = {
        "csrf-token": JSESSIONID,
        "x-restli-protocol-version": "2.0.0",
        "accept": "application/json",
        "content-type": "application/json"
      };

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const profileArray = data.data.identityDashProfileEditFormPagesByProfileEditFormType.elements?.[0];
      const contactInfo = profileArray.profileFormResolutionResult.contactInfoForm;
      const email = contactInfo.email.link.appearance.text;
      return email;
    } catch (error) {
    }
  },
  updatePostDetails: async ({ payload }) => {
    try {
      const { id, token, linkedin_post_id, post_type, status, message } = payload;
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append("Authorization", `Bearer ${token}`);
      const raw = JSON.stringify({
        "linkedin_post_id": linkedin_post_id,
        "status": status,
        "message": message
      });
      const requestOptions = {
        method: "PATCH",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
      };
      const url = `${ApiUrl}/content/edit-post-status/${id}`
      fetch(url, requestOptions)
        .then((response) => response.json())
        .then((result) => {
          return result;
        })
        .catch(() => { });
    } catch (error) {
      let errorMessage = String(error?.message);

      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + "...";
      }
      throw new Error(errorMessage);
    }
  }
};
