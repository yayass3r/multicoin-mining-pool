{
  "targets": [
    {
      "target_name": "blake3_native",
      "sources": [
        "blake3.cc",
        "blake3_impl.c",
        "blake3_dispatch.c",
        "blake3_portable.c"
      ],
      "conditions": [
        ["OS=='linux'", {
          "sources": [
            "blake3_sse41_x86-64_unix.S",
            "blake3_avx2_x86-64_unix.S",
            "blake3_avx512_x86-64_unix.S"
          ]
        }],
        ["OS=='win'", {
          "sources": [
            "blake3_sse41_x86-64_windows_msvc.asm",
            "blake3_avx2_x86-64_windows_msvc.asm",
            "blake3_avx512_x86-64_windows_msvc.asm"
          ]
        }],
        ["OS=='mac'", {
          "sources": [
            "blake3_sse41_x86-64_unix.S",
            "blake3_avx2_x86-64_unix.S",
            "blake3_avx512_x86-64_unix.S"
          ]
        }]
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "."
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native", "-ffast-math"],
      "cflags_cc": ["-O3", "-march=native", "-ffast-math", "-std=c++17"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "libraries": ["-lpthread"]
    }
  ]
}
