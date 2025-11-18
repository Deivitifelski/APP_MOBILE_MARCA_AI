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
    
    // Inicializar Firebase apenas se GoogleService-Info.plist existir
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      print("✅ Firebase: Configurando...")
      FirebaseApp.configure()
      // Configurar FCM
      Messaging.messaging().delegate = self
      print("✅ Firebase: Configurado com sucesso")
    } else {
      print("⚠️ GoogleService-Info.plist não encontrado. Firebase não será inicializado.")
      print("💡 Para adicionar: Baixe do Firebase Console e adicione ao projeto Xcode.")
    }
    
    // Configurar notificações
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
    
    // Criar factory e delegate do React Native
    print("⚛️ Criando React Native factory...")
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    // Criar window e inicializar React Native
    print("⚛️ Criando window e inicializando React Native...")
    window = UIWindow(frame: UIScreen.main.bounds)
    
    // Criar root view usando o factory
    let rootViewFactory = factory.rootViewFactory
    let rootView = rootViewFactory.view(
      withModuleName: "expo-router/entry",
      initialProperties: nil,
      launchOptions: launchOptions
    )
    
    // Criar root view controller usando o delegate
    let rootViewController = delegate.createRootViewController()
    
    // Configurar root view no view controller
    rootViewController.view = rootView
    
    // Configurar window
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()
    
    print("✅ React Native inicializado")
    print("✅ Window criada e visível")
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Registrar para notificações remotas
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Configurar APNs token para FCM
    Messaging.messaging().apnsToken = deviceToken
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
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
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
    print("🔑 Token FCM recebido: \(fcmToken ?? "nil")")
  }
}
