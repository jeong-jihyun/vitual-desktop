plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.deskcontrol.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.deskcontrol.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-phase3"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // 서버와의 REST/WebSocket 통신 (server/의 API·시그널링 프로토콜과 동일하게 사용)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // 접속 비밀번호로 받은 JWT를 안전하게 저장
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // WebRTC - Google이 더 이상 Maven에 공식 배포하지 않아, org.webrtc.* API를 그대로
    // 유지하는 커뮤니티 유지보수 빌드(GetStream)를 사용한다.
    implementation("io.getstream:stream-webrtc-android:1.3.9")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
