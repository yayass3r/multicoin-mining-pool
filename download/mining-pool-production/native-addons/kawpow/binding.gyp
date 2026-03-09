{
  "targets": [
    {
      "target_name": "kawpow_native",
      "sources": [
        "kawpow.cc",
        "ethash/ethash.cpp",
        "ethash/keccak.cpp",
        "ethash/managed.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "ethash"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math", "-fomit-frame-pointer"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='linux'", {
          "libraries": ["-lpthread"]
        }]
      ]
    }
  ]
}
