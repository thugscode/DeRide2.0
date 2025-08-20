module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true,
        "mocha": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "rules": {
        "indent": "off",
        "linebreak-style": "off",
        "quotes": "off",
        "semi": [
            "error",
            "always"
        ],
        "no-unused-vars": ["error", { "args": "none", "varsIgnorePattern": "clientIdentity" }],
        "no-console": "off"
    },
    "globals": {
        "Buffer": true,
        "Promise": true
    }
};
