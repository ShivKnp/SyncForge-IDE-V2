const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules.unshift({
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto",
      });
      return webpackConfig;
    },
    plugins: {
      add: [
        new MonacoWebpackPlugin({
          // Add the languages you need.
          // This helps reduce the final bundle size.
          languages: [
            "javascript",
            "typescript",
            "python",
            "cpp",
            "java",
            "json",
          ],
        }),
      ],
    },
  },
};
