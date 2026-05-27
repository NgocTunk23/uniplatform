const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// Đảm bảo lấy đúng URL của backend (thường là http://localhost:5001 ở local)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

// ==========================================
// 1. CẤU HÌNH GOOGLE OAUTH
// ==========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/api/auth/google/callback`
  },
  function(accessToken, refreshToken, profile, done) {
    // Chuẩn hóa dữ liệu trả về cho Controller dễ đọc
    const userProfile = {
      email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
      displayName: profile.displayName,
      username: profile.id // Google không có username, dùng ID làm chuỗi gốc
    };
    return done(null, userProfile);
  }
));

// ==========================================
// 2. CẤU HÌNH GITHUB OAUTH
// ==========================================
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/api/auth/github/callback`,
    scope: ['user:email'] // Bắt buộc để lấy được email của GitHub
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      // Nếu profile không có email, fetch từ GitHub API
      let email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
      
      if (!email) {
        // Fetch email từ GitHub API
        const https = require('https');
        const options = {
          hostname: 'api.github.com',
          path: '/user/emails',
          method: 'GET',
          headers: {
            'Authorization': `token ${accessToken}`,
            'User-Agent': 'Uniplatform-App'
          }
        };
        
        const emailData = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          });
          req.on('error', reject);
          req.end();
        });
        
        const primaryEmail = emailData.find(e => e.primary && e.verified);
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }

      // Chuẩn hóa dữ liệu trả về cho Controller dễ đọc
      const userProfile = {
        email: email,
        displayName: profile.displayName || profile.username,
        username: profile.username || profile.id
      };
      return done(null, userProfile);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }
));

module.exports = passport;