import { DataListener, EventType } from './database-internal';
import { DataSnapshot } from './data-snapshot';
import { DataModel } from './data-model';
import { Path } from './path';
import { Subject } from 'rxjs/Subject';
import { Observer } from 'rxjs/Observer';
import { Observable, ObservableInput } from 'rxjs/Observable';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/share';

/**
 * @internal
 */
export class Notifier {
  private _subject = new Subject<NotifierEvent>();
  private _paused = false;

  /**
   * Prevents the notifier from processing and emitting any new events. Useful when bootstrapping.
   */
  pause() {
    this._paused = true;
  }

  /**
   * Tells the notifier to resume processing and emitting any new events
   */
  resume() {
    this._paused = false;
  }

  forListener(listener: DataListener, mergeWith?: ObservableInput<NotifierEvent>): Observable<DataSnapshot> {
    return Observable.create((observer: Observer<DataSnapshot>) => {
      let notifier$ = this._subject.asObservable();

      if (mergeWith) {
        notifier$ = notifier$.merge(mergeWith);
      }

      const subscription = notifier$
        .filter((event: NotifierEvent): boolean => {
          // TODO: take query options into account

          return (!event.tag || (event.tag === listener.tag))
            && (event.type === listener.type)
            && listener.query.path.isEqual(event.path);
        })
        .do((event: NotifierEvent) => {
          // Let's keep track of all the "optimistic" updates in case we need to roll them back
          if (event.optimisticEvents) {
            event.optimisticEvents.push(event);
          }
        })
        .map((event: NotifierEvent): DataSnapshot => new DataSnapshot(listener.query, event.model, !!event.optimisticEvents))
        .subscribe(observer);

      // Store the observer inside its DataListener
      listener.observer = observer;

      return () => subscription.unsubscribe();
    });

  }

  trigger(path: Path,
          oldModel: DataModel,
          newModel: DataModel,
          tag = 0,
          {
            bubbleUpValue = false,
            bubbleUpChildChangedUntil = null,
            downLevels = Infinity,
            skipEqualityCheck = false,
            useSubject,
            optimisticEvents,
          }: TriggerOptions = {}) {

    // If the notifier has been paused, don't do anything.
    // This is used when bootstrapping with locally-stored data.
    if (this._paused) {
      return;
    }

    if (newModel.hasChildren()) {
      if (downLevels > 0) {
        downLevels -= 1;

        newModel.forEachChild((key: string, child: DataModel) => {
          this.trigger(path.child(key), oldModel.child(key), child, tag, {
            bubbleUpChildChangedUntil: path,
            downLevels,
            useSubject,
            optimisticEvents
          });
        });
      }
    }

    // In general we emit on the notifier's own subject, but in some cases we want to emit on
    // some other subject. For example, when emiting cached data for a single listener.
    const subject = useSubject || this._subject;

    const notification = {tag, optimisticEvents};
    let parentPath = path.parent;
    let modelHasChanged: boolean = skipEqualityCheck ? true : undefined;

    if (parentPath) {

      // TODO: detect and trigger "child_moved" events
      // TODO: take query (tag) into account. It might affect child added/removed

      // Check for child added, removed, changed
      if (oldModel.exists()) {
        if (!newModel.exists()) {
          // Trigger "child_removed" on the parent for this node
          if (path.parent) {
            subject.next({...notification, type: 'child_removed', path: parentPath, model: oldModel});
          }

          // Trigger value and child_removed for any descendants
          this.cascadeNodeRemoved(path, oldModel, tag, false);
        } else {
          // Trigger "child changed" event for this node if the data has changed
          // FIXME: Checking model equality here is incredibly wasteful. Find a better option.
          if ((modelHasChanged === true) || !newModel.isEqual(oldModel)) {
            subject.next({
              ...notification,
              type: 'child_changed',
              path: parentPath,
              model: newModel,
              rollbackModel: optimisticEvents && oldModel
            });
            modelHasChanged = true;
          } else {
            modelHasChanged = false;
          }
        }
      } else {
        if (newModel.exists()) {
          /* TODO:
           The official SDK also passes the key for the previous child by sort order. Maybe that could
           be done inside or after the notifier's filter. Look into it.
           */
          subject.next({...notification, type: 'child_added', path: parentPath, model: newModel});

          // Bubble up a "child_added" event for any ancestors of this
          // node's parent until the path exists in the old model
          let parentPathParent = parentPath.parent;

          if (parentPathParent) {
            let parentPathChild = parentPath;
            let oldModelParent = oldModel.parent;
            let newModelParent = newModel.parent;

            while (parentPathParent && !oldModelParent.child(parentPathChild.key).exists()) {
              subject.next({
                ...notification,
                type: 'child_added',
                path: parentPathParent,
                model: newModelParent
              });

              oldModelParent = oldModelParent.parent;
              newModelParent = newModelParent.parent;
              parentPathChild = parentPathChild.parent;
              parentPathParent = parentPathParent.parent;
            }
          }
        }
      }

      // Bubble up a "child_changed" event for any ancestors of this
      // node's parent (up to the specified one to avoid duplicate events)
      let model = newModel.parent;
      parentPath = parentPath.parent;

      while (parentPath && !parentPath.includesOrEqualTo(bubbleUpChildChangedUntil)) {
        subject.next({
          ...notification,
          type: 'child_changed',
          path: parentPath,
          model: model,
          rollbackModel: optimisticEvents && oldModel.root.child(model.path)
        });
        parentPath = parentPath.parent;
        model = model.parent;
      }
    }

    // FIXME: Same as before, checking model equality here is incredibly wasteful. Find a better option.
    if (modelHasChanged || ((typeof modelHasChanged === 'undefined') && !newModel.isEqual(oldModel))) {
      // Emit a "value" event for this path
      subject.next({
        ...notification,
        type: 'value',
        path: path,
        model: newModel,
        rollbackModel: optimisticEvents && oldModel
      });

      if (bubbleUpValue) {
        // Bubble up a "value" event for any ancestors of this node
        let bubbleUpModel = newModel;
        let bubbleUpRollbackModel = oldModel;
        let bubbleUpPath = path;

        while (bubbleUpModel.parent) {
          subject.next({
            ...notification,
            type: 'value',
            path: bubbleUpPath.parent,
            model: bubbleUpModel.parent,
            rollbackModel: optimisticEvents && bubbleUpRollbackModel.parent
          });

          bubbleUpModel = bubbleUpModel.parent;
          bubbleUpRollbackModel = bubbleUpRollbackModel.parent;
          bubbleUpPath = bubbleUpPath.parent;
        }
      }

    }
  }

  private cascadeNodeRemoved(path: Path, model: DataModel, tag?: number, valueEvent = true) {
    if (model.hasChildren()) {
      model.children.forEach((child: DataModel) => {
        // Recursively process any children
        this.cascadeNodeRemoved(path.child(child.key), child, tag);

        // trigger a "child_removed" event on the path (parent) for this child
        this._subject.next({type: 'child_removed', path: path, model: child, tag});
      });

      if (valueEvent) {
        // Trigger a "value" evnet for this node
        this._subject.next({type: 'value', path: path, model, tag});
      }
    }
  }

}


/**
 * @internal
 */
export interface NotifierEvent {
  type: EventType;
  path: Path;
  model: DataModel;
  tag?: number; // Query tag
  optimisticEvents?: NotifierEvent[];
  rollbackModel?: DataModel;
}

interface TriggerOptions {
  bubbleUpValue?: boolean;
  bubbleUpChildChangedUntil?: Path;
  downLevels?: number;
  skipEqualityCheck?: boolean;
  useSubject?: Subject<NotifierEvent>;
  optimisticEvents?: NotifierEvent[];
}
