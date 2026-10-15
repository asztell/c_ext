{
  "targets": [
    {
      "target_name": "math_addon",
      "sources": [ "addon.cpp" ],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "dependencies": [
        "node_modules/node-addon-api/node_addon_api.gyp:node_addon_api"
      ],
      "cflags_cc": [ "-std=c++17" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}
