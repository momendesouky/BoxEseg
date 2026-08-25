const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('./env');
const container = require('./container');

function configurePassport(passport) {
  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await container.userRepository.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  if (env.facebook.appId && env.facebook.appSecret) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: env.facebook.appId,
          clientSecret: env.facebook.appSecret,
          callbackURL: env.facebook.callbackUrl,
          profileFields: ['id', 'displayName', 'emails', 'photos'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await container.authService.loginWithOAuth('facebook', profile);
            done(null, user);
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }

  if (env.google.clientId && env.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.google.clientId,
          clientSecret: env.google.clientSecret,
          callbackURL: env.google.callbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const user = await container.authService.loginWithOAuth('google', profile);
            done(null, user);
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }
}

module.exports = configurePassport;
