package com.agribridge.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

@Component
@Slf4j
public class StompDebugEventListener {

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        log.debug("Websocket STOMP connected sessionId={} user={}", headers.getSessionId(), headers.getUser());
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        log.debug("Supplier subscribed destination={} sessionId={} subscriptionId={} user={}",
                headers.getDestination(), headers.getSessionId(), headers.getSubscriptionId(), headers.getUser());
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        log.debug("Websocket STOMP disconnected sessionId={} status={}", event.getSessionId(), event.getCloseStatus());
    }
}
