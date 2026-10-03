package com.tuben.app

import android.content.pm.ActivityInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaCodec
import android.net.Uri
import android.view.View
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.Executors

class TubenNativeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val worker = Executors.newSingleThreadExecutor()
  override fun getName() = "TubenNativeModule"

  @ReactMethod
  fun setScreenOrientation(orientation: String, promise: Promise) {
    val activity = context.currentActivity ?: return promise.resolve(false)
    activity.runOnUiThread {
      activity.requestedOrientation = when (orientation) {
        "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
      promise.resolve(true)
    }
  }

  @Suppress("DEPRECATION")
  @ReactMethod
  fun setPlayerFullscreen(fullscreen: Boolean, promise: Promise) {
    val activity = context.currentActivity ?: return promise.resolve(null)
    activity.runOnUiThread {
      activity.window.decorView.systemUiVisibility = if (fullscreen)
        View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      else View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun mergeMediaTracks(video: String, audio: String, output: String, promise: Promise) {
    worker.execute {
      val inputs = listOf(MediaExtractor(), MediaExtractor())
      val outputFile = File(Uri.parse(output).path ?: output)
      var muxer: MediaMuxer? = null
      try {
        outputFile.parentFile?.mkdirs()
        if (outputFile.exists()) outputFile.delete()
        val target = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        muxer = target
        val tracks = inputs.mapIndexed { index, extractor ->
          extractor.setDataSource(context, Uri.parse(if (index == 0) video else audio), null)
          val type = if (index == 0) "video/" else "audio/"
          val sourceTrack = (0 until extractor.trackCount).firstOrNull {
            extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith(type) == true
          } ?: throw IllegalArgumentException("İndirilen dosyada $type parçası bulunamadı.")
          extractor.selectTrack(sourceTrack)
          target.addTrack(extractor.getTrackFormat(sourceTrack))
        }
        target.start()
        val buffer = ByteBuffer.allocateDirect(16 * 1024 * 1024)
        inputs.forEachIndexed { index, extractor ->
          val info = MediaCodec.BufferInfo()
          var samples = 0
          while (true) {
            buffer.clear()
            val size = extractor.readSampleData(buffer, 0)
            if (size < 0) break
            info.set(0, size, extractor.sampleTime, extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC)
            target.writeSampleData(tracks[index], buffer, info)
            samples++
            extractor.advance()
          }
          check(samples > 0) { "İndirilen medya parçası boş." }
        }
        target.stop()
        target.release()
        muxer = null
        promise.resolve(output)
      } catch (error: Exception) {
        outputFile.delete()
        promise.reject("MERGE_FAILED", "Ses ve video birleştirilemedi.", error)
      } finally {
        inputs.forEach { it.release() }
        muxer?.release()
      }
    }
  }
  override fun invalidate() { worker.shutdown(); super.invalidate() }
}

class TubenPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(TubenNativeModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
