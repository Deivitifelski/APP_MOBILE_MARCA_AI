import Expo
import React
import ReactAppDependencyProvider
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import UIKit

@UIApplicationMain
@objc(AppDelegate)
public class AppDelegate: ExpoAppDelegate {
  @objc public var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    print("🚀 AppDelegate: Iniciando aplicação...")
    
    // ⚠️ IMPORTANTE: Configurar Firebase ANTES de super.application()
    // Isso garante que o Firebase esteja disponível quando o React Native inicializar
    let googleServiceInfoPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist")
    
    if googleServiceInfoPath != nil {
      // Arquivo existe, configurar Firebase
      if FirebaseApp.app() == nil {
        print("✅ Firebase: Configurando com GoogleService-Info.plist...")
        FirebaseApp.configure()
        
        // Configurar FCM apenas se Firebase foi configurado com sucesso
        if FirebaseApp.app() != nil {
          Messaging.messaging().delegate = self
          print("✅ Firebase Messaging: Configurado com sucesso")
        }
      } else {
        print("✅ Firebase: Já estava configurado")
      }
    } else {
      // Arquivo não existe - Firebase não será configurado
      print("⚠️ GoogleService-Info.plist não encontrado.")
      print("⚠️ Firebase não será inicializado.")
      print("💡 Para habilitar Firebase e notificações push:")
      print("   1. Acesse https://console.firebase.google.com/")
      print("   2. Selecione seu projeto")
      print("   3. Vá em Configurações do Projeto → iOS apps")
      print("   4. Baixe o GoogleService-Info.plist")
      print("   5. Arraste o arquivo para o projeto Xcode (pasta ios/MarcaAI/)")
      print("   6. Certifique-se de que está marcado no Target Membership")
    }
    
    // ⚠️ CRÍTICO: Chamar super.application() DEPOIS de configurar Firebase
    // O ExpoAppDelegate inicializa o React Native, que pode precisar do Firebase
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    
    // Configurar notificações de forma assíncrona para não bloquear a inicialização
    DispatchQueue.main.async {
      print("🔔 Configurando notificações...")
      UNUserNotificationCenter.current().delegate = self
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
        if granted {
          print("✅ Permissão de notificação concedida")
          DispatchQueue.main.async {
            application.registerForRemoteNotifications()
          }
        } else {
          print("❌ Permissão de notificação negada: \(error?.localizedDescription ?? "desconhecido")")
        }
      }
    }
    
    return result
  }
  
  // Registrar para notificações remotas
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Configurar APNs token para FCM apenas se Firebase estiver configurado
    if FirebaseApp.app() != nil {
      Messaging.messaging().apnsToken = deviceToken
      print("✅ APNs token configurado para FCM")
    } else {
      print("⚠️ Firebase não configurado - APNs token não será enviado para FCM")
    }
  }
  
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("❌ Falha ao registrar para notificações remotas: \(error.localizedDescription)")
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Em desenvolvimento, usar Metro bundler
    // Para expo-router, usar "index" como bundleRoot
    // O Metro vai resolver através do package.json "main": "expo-router/entry"
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    // Em produção, usar bundle embutido
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {
  // Receber notificação quando o app está em foreground
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let userInfo = notification.request.content.userInfo
    print("📱 Notificação recebida em foreground: \(userInfo)")
    
    // Mostrar notificação mesmo em foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .badge, .sound])
    } else {
      completionHandler([.alert, .badge, .sound])
    }
  }
  
  // Usuário tocou na notificação
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    print("📱 Usuário tocou na notificação: \(userInfo)")
    
    completionHandler()
  }
}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
  // Receber token FCM
  public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    if let token = fcmToken {
      print("🔑 Token FCM recebido: \(token)")
    } else {
      print("⚠️ Token FCM não disponível")
    }
  }
}
