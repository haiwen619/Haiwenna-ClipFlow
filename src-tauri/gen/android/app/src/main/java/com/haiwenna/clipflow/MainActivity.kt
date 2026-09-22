package com.haiwenna.clipflow

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // 设置状态栏与底部导航栏图标文字为深色（适配浅色背景）
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }

    // 动态监听系统 Insets（状态栏、刘海/挖孔、手势导航栏），将安全边距应用到内容容器
    // 彻底解决系统时钟/电量遮挡 Header 以及底部手势条遮挡操作按钮的问题
    ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, windowInsets ->
      val insets = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
      windowInsets
    }
  }
}
