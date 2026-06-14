import baseConfig from './app.json' with { type: 'json' };

export default {
  ...baseConfig.expo,
  android: {
    ...baseConfig.expo.android,
    package: baseConfig.expo.android.package,
    // Credencial FCM (gerada pelo Firebase) — necessaria para o Expo Push Token
    // funcionar no Android. Nao exige codigo Firebase; e so a ponte para o FCM.
    googleServicesFile: './google-services.json',
  },
  extra: {
    apiUrl: process.env.API_URL,
    eas: {
      projectId: '4ab244dd-ed95-4acf-8565-42b26bdca678',
    },
  },
};
