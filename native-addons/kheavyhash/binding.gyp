{
  "targets": [
    {
      "target_name": "kheavyhash",
      "sources": ["kheavyhash.cc"],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags": ["-O3", "-march=native"],
      "cflags_cc": ["-O3", "-std=c++17", "-march=native"]
    }
  ]
}
