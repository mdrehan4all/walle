import { Observable, merge, Subject, BehaviorSubject, from, of } from 'rxjs';
import { Injectable, NgZone } from '@angular/core';
import { map, filter, tap, takeUntil, catchError } from 'rxjs/operators';
import {
	IWindow,
	Action,
	SpeakingStarted,
	SpeakingEnded,
	ListeningEnded,
	SpeakAction,
	ListeningStarted,
	RecognizedText,
	RecognizedTextAction,
} from '../classes/models';

@Injectable({
	providedIn: 'root',
})
export class SenseService {
	private defaultVoiceName = 'Google US English';
	private language = 'en-US';

	destroy$ = new Subject();

	window: IWindow;
	listener: any;
	speaker: any;

	isAllowed = true;

	voices: any[] = [];
	private _voices$ = new BehaviorSubject(null);
	voices$ = this._voices$.asObservable();

	private _activeVoice$ = new BehaviorSubject(null);
	activeVoice$ = this._activeVoice$.asObservable();

	private _action$ = new Subject<Action>();
	action$ = this._action$.asObservable();

	hasMicrofonAccess$ = from(
		navigator.mediaDevices.getUserMedia({ audio: true })
	).pipe(
		map(() => true),
		catchError((err) => {
			console.error(err);
			console.log('No microphone access');
			return of(false);
		})
	);

	set isSpeaking(val: boolean) {
		this.speaker._isSpeaking = val;
	}

	get isSpeaking(): boolean {
		return !!this.speaker._isSpeaking;
	}

	set isListening(val: boolean) {
		this.listener._isListening = val;
	}

	get isListening(): boolean {
		return !!this.listener._isListening;
	}

	constructor(private zone: NgZone) {
		this.window = (window as unknown) as IWindow;

		this.createSpeaker();
		this.createListener();

		this.subscriptions();
	}

	subscriptions() {
		this.getType(SpeakingStarted)
			.pipe(
				// tap(()=> console.log('will stop recognition')),
				tap(() => this.stopListening()),
				takeUntil(this.destroy$)
			)
			.subscribe();

		merge(this.getType(SpeakingEnded), this.getType(ListeningEnded))
			.pipe(
				filter(() => !this.isSpeaking),
				// tap(()=> console.log('will start recognition')),
				tap(() => this.startListening()),
				takeUntil(this.destroy$)
			)
			.subscribe();

		this.getType(SpeakAction)
			.pipe(
				tap((text) => this._speak(text)),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	getType(action: Action | any): Observable<any> {
		return this.action$.pipe(
			filter((i) => i instanceof action),
			map((i) => i.payload),
			takeUntil(this.destroy$)
		);
	}

	private createSpeaker() {
		const key: any = '_ms_Speaker';
		if (this.window[key]) {
			console.log('speaker found');
			this.speaker = this.window[key];
			this.getVoices();
			return;
		}

		this.speaker = new SpeechSynthesisUtterance();
		this.window[key] = this.speaker;
		// this.speaker.voiceURI = 'native';
		// this.speaker.volume = 1; // 0 to 1
		// this.speaker.rate = 1; // 0.1 to 10
		// this.speaker.pitch = 0; //0 to 2
		// this.speaker.text = 'Hello World';
		// this.speaker.lang = this.language;

		this.speaker.onstart = () => {
			this.zone.run(() => {
				this.isSpeaking = true;
				this._action$.next(new SpeakingStarted());
			});
		};

		this.speaker.onend = () => {
			this.zone.run(() => {
				this.isSpeaking = false;
				this._action$.next(new SpeakingEnded());
			});
		};

		this.loadVoices();
	}

	private getVoices() {
		const voices: any = this.window.speechSynthesis.getVoices();

		this.voices = voices;
		this._voices$.next(voices);

		const voice_us = voices.find((i: any) => {
			// console.log(i.name);
			return i.name.indexOf(this.defaultVoiceName) > -1;
		});

		this.onVoiceSelected(voice_us, false);
	}

	private loadVoices() {
		this.window.speechSynthesis.onvoiceschanged = () => {
			this.zone.run(() => {
				this.getVoices();
			});

			// we are removing the function after its called,
			// as we will not need this to be called any more.
			this.window.speechSynthesis.onvoiceschanged = null;
		};
	}

	private createListener() {
		const key: any = '_ms_Listener';
		if (this.window[key]) {
			console.log('recognition found');
			this.listener = this.window[key];
			this.startListening();
			return;
		}

		const webkitSpeechRecognition = this.window.webkitSpeechRecognition;
		this.listener = new webkitSpeechRecognition();
		this.window[key] = this.listener;
		this.listener.continuous = true;
		this.listener.interimResults = true;
		// this.listener.lang = this.language;
		this.listener.maxAlternatives = 1;
		this.listener.maxResults = 25;

		this.listener.onstart = () => {
			this.zone.run(() => {
				this.isListening = true;
				this._action$.next(new ListeningStarted());
			});
		};

		this.listener.onresult = (speech: any) => {
			if (speech.results) {
				let term: RecognizedText;
				term = this.extractText(speech);
				// console.log(term)

				if (term.isFinal) {
					this.zone.run(() => {
						this._action$.next(new RecognizedTextAction(term.term));
					});
				}
			}
		};

		this.listener.onerror = (error: any) => {
			if (error.error === 'no-speech') {
			} else if (error.error === 'not-allowed') {
				this.isAllowed = false;
			} else {
				console.error(error.error);
			}
		};

		this.listener.onend = () => {
			this.zone.run(() => {
				// console.log('recognition onend');
				this.isListening = false;
				this._action$.next(new ListeningEnded());
			});
		};

		this.startListening();
	}

	private stopListening() {
		this.listener.stop();
	}

	private startListening() {
		if (!this.startListening) {
			return;
		}
		try {
			console.log('recognition started');

			if (!this.isAllowed) {
				return;
			}

			this.listener.start();
		} catch {}
	}

	onVoiceSelected(voice: any, speak = true) {
		this.speaker.voice = voice;
		this._activeVoice$.next(voice);
    
	  this.speaker.lang = voice.lang;

    if(this.listener){
		  this.listener.lang = voice.lang;
    }

		if (speak) this._speak('Kiss my shiny metal head');
	}

	extractText(speech: any): RecognizedText {
		let term = '';
		let result = speech.results[speech.resultIndex];
		let transcript = result[0].transcript;
		let confidence = result[0].confidence;
		if (result.isFinal) {
			if (result[0].confidence < 0.3) {
				// console.log('Not recognized');
			} else {
				term = transcript.trim();
				// console.log(term);
			}
		} else {
			if (result[0].confidence > 0.6) {
				term = transcript.trim();
			}
		}
		// return term;
		return <RecognizedText>{
			term,
			confidence,
			isFinal: result.isFinal,
		};
	}

	speak(text: string) {
		this._action$.next(new SpeakAction(text));
	}

	private _speak(text: string): void {
		console.log('speaking...');
		this.speaker.text = text;
		this.window.speechSynthesis.speak(this.speaker);
	}

	activate() {
		this.window.speechSynthesis.cancel();
		this.speak('Activated');
	}
}
