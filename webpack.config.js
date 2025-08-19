const path = require('path');

module.exports = {
    mode: 'development', // or 'production' or 'none'
    entry: './app.js',
    output: {
        filename: 'RoutePlannerApp.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    browsers: ['last 2 versions']
                                }
                            }]
                        ]
                    }
                }
            }
        ]
    },
    watch: true // Enable watch mode
};