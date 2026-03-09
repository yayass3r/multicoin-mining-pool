{
  "targets": [
    {
      "target_name": "kheavyhash_native",
      "sources": [
        "kheavyhash.cc",
        "heavyhash.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='linux'", {
          "libraries": ["-lpthread"]
        }],
        ["OS=='win'", {
          "libraries": ["ws2_32.lib"]
        }]
      ]
    }
  ]
}
