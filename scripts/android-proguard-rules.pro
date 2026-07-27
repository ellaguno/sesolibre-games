# Reglas de R8 para la app.
#
# El grueso lo aportan las librerías: @capacitor/android declara sus reglas como
# `consumerProguardFiles`, así que las clases anotadas con @CapacitorPlugin y las
# que extienden com.getcapacitor.Plugin ya se conservan automáticamente. Lo de
# aquí abajo es defensa explícita para lo que se resuelve por reflexión o desde
# JavaScript, que R8 no puede ver rastreando el código Java.

# --- Puente WebView <-> nativo ---
# Los métodos expuestos a JavaScript solo se invocan desde la WebView; sin esto
# R8 podría renombrarlos o eliminarlos y el puente dejaría de responder.
-keepclasseswithmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Capacitor ---
# El puente instancia los plugins por nombre de clase y lee sus anotaciones en
# tiempo de ejecución, de modo que hay que conservar también los metadatos.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class com.capacitorjs.plugins.** { *; }

# --- Cordova (los plugins de Capacitor pueden apoyarse en él) ---
-keep class org.apache.cordova.** { *; }

# --- Actividad declarada en el manifiesto ---
-keep class com.sesolibre.sesolibregames.MainActivity { *; }

# Números de línea legibles en los informes de fallos de Play Console, sin
# revelar los nombres de fichero originales.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# La app no usa serialización por reflexión ni JNI propio, así que no hacen
# falta más excepciones: cuanto menos se conserve, más margen tiene R8.
