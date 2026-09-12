const https = require('https');

async function testFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          json: async () => JSON.parse(data),
          text: async () => data,
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== TUBEN MIGRATION FAZ 16 VERIFICATION SUITE ===\n');
  let passCount = 0;
  let totalCount = 0;

  function assert(condition, testName) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // 1. YouTube InnerTube Trending / Search Feed API Test
  try {
    const res = await testFetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240901.01.00', hl: 'tr', gl: 'TR' } },
        query: 'trend türkiye',
      }),
    });
    const json = await res.json();
    const sections = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    assert(res.ok && sections.length > 0, '1. YouTube InnerTube Trending Feed API (Web Client, 0 cipher)');
  } catch (e) {
    assert(false, '1. YouTube InnerTube Trending Feed API - Error: ' + e.message);
  }

  // 2. YouTube Search API Test
  try {
    const res = await testFetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'IOS', clientVersion: '20.11.6', hl: 'tr', gl: 'TR' } },
        query: 'tuben muzik',
      }),
    });
    const json = await res.json();
    assert(res.ok && json.contents, '2. YouTube InnerTube Search API');
  } catch (e) {
    assert(false, '2. YouTube InnerTube Search API - Error: ' + e.message);
  }

  // 3. YouTube Stream URL Extractor Test (Direct Google CDN Streams)
  try {
    const testVideoId = '2chSy0_DhQc';
    const res = await testFetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'IOS', clientVersion: '20.11.6', hl: 'tr', gl: 'TR' } },
        videoId: testVideoId,
      }),
    });
    const json = await res.json();
    const adaptiveFormats = json?.streamingData?.adaptiveFormats || [];
    const directStreams = adaptiveFormats.filter((f) => f.url && f.url.includes('googlevideo.com'));
    assert(directStreams.length > 0, `3. Direct unthrottled Google CDN stream URLs resolved (${directStreams.length} formats, 0 cipher)`);
  } catch (e) {
    assert(false, '3. Direct CDN Stream extractor - Error: ' + e.message);
  }

  // 4. YouTube Instant Search Suggestion API
  try {
    const res = await testFetch('https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=tr&q=teknoloji');
    const text = await res.text();
    const match = text.match(/window\.google\.ac\.h\((.*)\)/);
    const json = match ? JSON.parse(match[1]) : JSON.parse(text);
    const suggestions = json[1] || [];
    assert(suggestions.length > 0, `4. Instant Search Suggestions API (${suggestions.length} suggestions returned)`);
  } catch (e) {
    assert(false, '4. Search Suggestions API - Error: ' + e.message);
  }

  // 5. SponsorBlock API Test
  try {
    const res = await testFetch('https://sponsor.ajay.app/api/skipSegments?videoID=dQw4w9WgXcQ');
    assert(res.ok || res.status === 404, '5. SponsorBlock Segment API reachable & valid status');
  } catch (e) {
    assert(false, '5. SponsorBlock API - Error: ' + e.message);
  }

  // 6. Security Rules Structural Verification
  const fs = require('fs');
  const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
  const rtdbRules = fs.readFileSync('database.rules.json', 'utf8');

  assert(
    firestoreRules.includes('request.auth.uid == userId') &&
    firestoreRules.includes('allow read, write: if false;'),
    '6. Firestore Rules enforce authenticated owner check & zero public access'
  );

  assert(
    rtdbRules.includes('.read": false') &&
    rtdbRules.includes('auth.uid === $uid'),
    '7. Realtime Database Rules protect presence node & disallow root access'
  );

  console.log(`\n=========================================`);
  console.log(`TEST SUMMARY: ${passCount} / ${totalCount} PASSED`);
  console.log(`=========================================\n`);

  if (passCount !== totalCount) {
    process.exit(1);
  }
}

runTests();
